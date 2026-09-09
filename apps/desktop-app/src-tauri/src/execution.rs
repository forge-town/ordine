use crate::data_directory::validate_data_directory;
use crate::process_tree::ProcessTree;
use crate::protocol::{discard_output, read_ready, token};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};

const DEFAULT_PORT: u16 = 19433;
const STARTUP_TIMEOUT: Duration = Duration::from_secs(45);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(35);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub phase: String,
    pub instance_id: String,
    pub workspace_id: String,
    pub port: Option<u16>,
    pub error: Option<String>,
    pub database_configured: bool,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DatabaseConfiguration {
    database_url: Option<String>,
    schema: Option<String>,
    #[serde(default)]
    initialize: bool,
    #[serde(default, skip_serializing)]
    save_configuration: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    base_url: String,
    app_token: String,
    instance_id: String,
    workspace_id: String,
}

struct OwnedProcess {
    child: Child,
    _tree: ProcessTree,
}
impl Drop for OwnedProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

struct Inner {
    status: Status,
    configuration: DatabaseConfiguration,
    child: Option<OwnedProcess>,
    app_token: String,
}

pub struct ExecutionSupervisor {
    inner: Mutex<Inner>,
    data_dir: PathBuf,
    resources: PathBuf,
    binary: PathBuf,
    mcp_binary: PathBuf,
    exiting: AtomicBool,
    pub exit_complete: AtomicBool,
}

fn protected_write(path: &PathBuf, bytes: &[u8]) -> Result<(), String> {
    use std::fs::OpenOptions;
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .map_err(|_| "Could not save the private Desktop configuration.")?;
    #[cfg(windows)]
    {
        let user = std::env::var("USERNAME").map_err(|_| "Could not identify the Windows user.")?;
        let domain = std::env::var("USERDOMAIN").unwrap_or_default();
        let mut acl = Command::new("icacls.exe");
        ProcessTree::configure(&mut acl);
        let result = acl
            .arg(path)
            .args(["/inheritance:r", "/grant:r", &format!("{domain}\\{user}:F")])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|_| "Could not protect the private Desktop configuration.")?;
        if !result.success() {
            return Err("Could not protect the private Desktop configuration.".into());
        }
    }
    file.write_all(bytes)
        .map_err(|_| "Could not save the private Desktop configuration.".into())
}

impl ExecutionSupervisor {
    pub fn new(app: &AppHandle) -> Result<Arc<Self>, String> {
        let home = app
            .path()
            .home_dir()
            .map_err(|_| "The user home directory is unavailable.")?;
        let data_dir = std::env::var_os("ORDINE_EXECUTION_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".ordine").join("v2"));
        validate_data_directory(&data_dir, &home)?;
        let saved = fs::read(data_dir.join("desktop-config.json"))
            .ok()
            .and_then(|bytes| serde_json::from_slice::<DatabaseConfiguration>(&bytes).ok())
            .unwrap_or_default();
        let configuration = DatabaseConfiguration {
            database_url: std::env::var("ORDINE_EXECUTION_DATABASE_URL")
                .ok()
                .or(saved.database_url),
            schema: std::env::var("ORDINE_EXECUTION_SCHEMA")
                .ok()
                .or(saved.schema),
            initialize: std::env::var("ORDINE_EXECUTION_INITIALIZE")
                .map(|v| v == "true")
                .unwrap_or(saved.initialize),
            save_configuration: false,
        };
        let resource = app
            .path()
            .resource_dir()
            .map_err(|_| "Packaged resources are unavailable.")?
            .join("resources/server");
        let resources = if cfg!(debug_assertions) && !resource.join("server-bundle.mjs").exists() {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/server")
        } else {
            resource
        };
        let executable_dir = std::env::current_exe()
            .map_err(|_| "Native executable location is unavailable.")?
            .parent()
            .ok_or("Native executable directory is unavailable.")?
            .to_path_buf();
        let suffix = if cfg!(windows) { ".exe" } else { "" };
        let locate = |name: &str| {
            let packaged = executable_dir.join(format!("{name}{suffix}"));
            if cfg!(debug_assertions) && !packaged.exists() {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("binaries")
                    .join(format!("{name}-{}{suffix}", env!("ORDINE_BUILD_TARGET")))
            } else {
                packaged
            }
        };
        Ok(Arc::new(Self {
            inner: Mutex::new(Inner {
                status: Status {
                    phase: "idle".into(),
                    instance_id: String::new(),
                    workspace_id: "local".into(),
                    port: None,
                    error: None,
                    database_configured: configuration.database_url.is_some(),
                },
                configuration,
                child: None,
                app_token: String::new(),
            }),
            data_dir,
            resources,
            binary: locate("ordine-server"),
            mcp_binary: locate("ordine-mcp"),
            exiting: AtomicBool::new(false),
            exit_complete: AtomicBool::new(false),
        }))
    }

    fn emit(&self, app: &AppHandle) {
        let _ = app.emit("execution-state", self.status());
    }
    pub fn status(&self) -> Status {
        self.inner.lock().unwrap().status.clone()
    }

    fn failed(&self, app: &AppHandle, message: String) {
        {
            let mut inner = self.inner.lock().unwrap();
            inner.child.take();
            inner.app_token.clear();
            inner.status.phase = "failed".into();
            inner.status.error = Some(message);
            inner.status.port = None;
        }
        self.emit(app);
    }

    pub fn start(
        self: &Arc<Self>,
        app: AppHandle,
        requested: Option<DatabaseConfiguration>,
    ) -> Result<Status, String> {
        let (configuration, instance) = {
            let mut inner = self.inner.lock().unwrap();
            if self.exiting.load(Ordering::SeqCst) {
                return Err("Desktop is shutting down.".into());
            }
            if matches!(
                inner.status.phase.as_str(),
                "starting" | "ready" | "stopping"
            ) {
                return Err("The existing native server lifecycle is still active.".into());
            }
            if let Some(config) = requested {
                if config
                    .database_url
                    .as_ref()
                    .is_some_and(|url| !url.is_empty())
                {
                    inner.configuration = config;
                }
            }
            let instance = uuid::Uuid::new_v4().to_string();
            inner.status = Status {
                phase: "starting".into(),
                instance_id: instance.clone(),
                workspace_id: "local".into(),
                port: None,
                error: None,
                database_configured: inner.configuration.database_url.is_some(),
            };
            (inner.configuration.clone(), instance)
        };
        self.emit(&app);
        let owned = self.clone();
        thread::spawn(move || {
            if let Err(error) = owned.launch(&app, configuration, instance) {
                owned.failed(&app, error);
            }
        });
        Ok(self.status())
    }

    fn launch(
        self: &Arc<Self>,
        app: &AppHandle,
        configuration: DatabaseConfiguration,
        instance: String,
    ) -> Result<(), String> {
        let database_url = configuration
            .database_url
            .as_ref()
            .filter(|url| !url.is_empty())
            .ok_or("Configure a dedicated PostgreSQL database or empty schema, then retry.")?;
        let parsed =
            reqwest::Url::parse(database_url).map_err(|_| "The PostgreSQL URL is invalid.")?;
        if !["postgres", "postgresql"].contains(&parsed.scheme()) || parsed.path().len() < 2 {
            return Err("The PostgreSQL URL must explicitly name a database.".into());
        }
        let schema = configuration.schema.as_deref().unwrap_or("public");
        if schema.is_empty()
            || schema.len() > 63
            || !schema
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
        {
            return Err(
                "Use a lowercase PostgreSQL schema identifier of at most 63 characters.".into(),
            );
        }
        let port = std::env::var("ORDINE_EXECUTION_PORT")
            .unwrap_or(DEFAULT_PORT.to_string())
            .parse::<u16>()
            .ok()
            .filter(|port| *port > 0)
            .ok_or("Desktop requires a fixed local port between 1 and 65535.")?;
        // This is a conflict check only, never an attempt to reuse an existing HTTP process.
        let reservation = std::net::TcpListener::bind(("127.0.0.1", port)).map_err(|_| {
            "The dedicated execution port is occupied. Close the owning app or choose another port."
        })?;
        fs::create_dir_all(&self.data_dir)
            .map_err(|_| "Could not create the separate v2 data directory.")?;
        if configuration.save_configuration {
            protected_write(
                &self.data_dir.join("desktop-config.json"),
                &serde_json::to_vec(&configuration)
                    .map_err(|_| "Could not serialize the Desktop configuration.")?,
            )?;
        }
        let app_token = token()?;
        let agent_token = token()?;
        let migration = self.resources.join("migrations-v2/0001_execution.sql");
        let bundle = self.resources.join("server-bundle.mjs");
        if !migration.is_file() || !bundle.is_file() || !self.binary.is_file() {
            return Err(
                "The packaged v2 server resources are missing. Rebuild or reinstall Desktop."
                    .into(),
            );
        }
        let mut command = Command::new(&self.binary);
        ProcessTree::configure(&mut command);
        command
            // Packaged startup must not resolve missing optional imports by downloading packages.
            .arg("--no-install")
            .arg(bundle)
            .current_dir(&self.data_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("NODE_ENV", "production")
            .env("ORDINE_EXECUTION_DATABASE_URL", database_url)
            .env("ORDINE_EXECUTION_SCHEMA", schema)
            .env(
                "ORDINE_EXECUTION_INITIALIZE",
                configuration.initialize.to_string(),
            )
            .env("ORDINE_EXECUTION_DATA_DIR", &self.data_dir)
            .env("ORDINE_EXECUTION_APP_TOKEN", &app_token)
            .env("ORDINE_EXECUTION_AGENT_TOKEN", agent_token)
            .env("ORDINE_EXECUTION_INSTANCE_ID", &instance)
            .env("ORDINE_EXECUTION_WORKSPACE_ID", "local")
            .env("ORDINE_EXECUTION_SUBJECT_ID", "owner")
            .env("ORDINE_EXECUTION_PORT", port.to_string())
            .env("ORDINE_EXECUTION_MIGRATION_PATH", migration)
            .env("ORDINE_EXECUTION_STDIN_CONTROL", "true")
            .env_remove("DATABASE_URL")
            .env_remove("DESKTOP_AUTH_TOKEN");
        drop(reservation);
        let mut child = command
            .spawn()
            .map_err(|_| "The packaged server could not be launched.")?;
        let tree = match ProcessTree::attach(&child) {
            Ok(tree) => tree,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let stdout = child
            .stdout
            .take()
            .ok_or("Server output pipe is unavailable.")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("Server error pipe is unavailable.")?;
        let (ready_tx, ready_rx) = mpsc::sync_channel::<serde_json::Value>(1);
        thread::spawn(move || read_ready(stdout, ready_tx));
        thread::spawn(move || discard_output(stderr));
        {
            let mut inner = self.inner.lock().unwrap();
            if self.exiting.load(Ordering::SeqCst) {
                return Err("Desktop is shutting down.".into());
            }
            child
                .stdin
                .as_mut()
                .ok_or("Server control pipe is unavailable.")?
                .write_all(b"ORDINE_EXECUTION_START\n")
                .map_err(|_| "Could not authorize the contained server to start.")?;
            inner.child = Some(OwnedProcess { child, _tree: tree });
            inner.app_token = app_token.clone();
        }
        let started = Instant::now();
        let ready = ready_rx.recv_timeout(STARTUP_TIMEOUT)
            .map_err(|_| "Server startup failed or timed out. Check the dedicated database and initialization setting, then retry.")?;
        if ready["apiVersion"] != 2
            || ready["instanceId"] != instance
            || ready["workspaceId"] != "local"
            || ready["port"] != port
        {
            return Err(
                "The launched server reported an unexpected API version or instance identity."
                    .into(),
            );
        }
        let client = reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|_| "Could not create the local readiness client.")?;
        let readiness = client
            .get(format!("http://127.0.0.1:{port}/api/v2/readiness"))
            .header("X-Desktop-Token", &app_token)
            .header("X-Ordine-Api-Version", "2")
            .send()
            .and_then(|response| response.error_for_status())
            .and_then(|response| response.json::<serde_json::Value>())
            .map_err(|_| "The launched server did not pass authenticated database readiness.")?;
        if readiness["ordineApiVersion"] != 2
            || readiness["graphSchemaVersion"] != 2
            || readiness["instanceId"] != instance
            || readiness["workspaceId"] != "local"
            || readiness["status"] != "ready"
            || readiness["database"]["reachable"] != true
            || readiness["database"]["schemaVersion"] != 2
        {
            return Err(
                "The local server identity or database schema did not match execution v2.".into(),
            );
        }
        {
            let mut inner = self.inner.lock().unwrap();
            if self.exiting.load(Ordering::SeqCst) {
                return Ok(());
            }
            if inner
                .child
                .as_mut()
                .ok_or("The server exited during startup.")?
                .child
                .try_wait()
                .map_err(|_| "Could not verify the owned server process.")?
                .is_some()
            {
                return Err("The server exited during startup.".into());
            }
            inner.status.phase = "ready".into();
            inner.status.port = Some(port);
        }
        self.emit(app);
        let owned = self.clone();
        let handle = app.clone();
        thread::spawn(move || {
            let _ = started;
            while !owned.exiting.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_millis(250));
                let exited = {
                    let mut inner = owned.inner.lock().unwrap();
                    inner
                        .child
                        .as_mut()
                        .map(|process| !matches!(process.child.try_wait(), Ok(None)))
                        .unwrap_or(false)
                };
                if exited {
                    owned.failed(&handle, "The execution server stopped unexpectedly. Existing jobs will be reconciled on an explicit retry.".into());
                    break;
                }
            }
        });
        Ok(())
    }

    pub fn credentials(&self) -> Result<Credentials, String> {
        let inner = self.inner.lock().unwrap();
        if inner.status.phase != "ready" {
            return Err("The execution server is not ready.".into());
        }
        Ok(Credentials {
            base_url: format!("http://127.0.0.1:{}", inner.status.port.unwrap()),
            app_token: inner.app_token.clone(),
            instance_id: inner.status.instance_id.clone(),
            workspace_id: "local".into(),
        })
    }

    pub fn mcp_configuration(&self) -> Result<serde_json::Value, String> {
        let credentials = self.credentials()?;
        Ok(
            serde_json::json!({ "mcpServers": { "ordine-v2": { "command": self.mcp_binary,
            "args": ["--policy", "safe"], "env": { "ORDINE_API_URL": credentials.base_url,
                "ORDINE_AUTH_MODE": "bearer", "ORDINE_AGENT_API_TOKEN_FILE": self.data_dir.join("agent-token") } } } }),
        )
    }

    pub fn begin_exit(self: &Arc<Self>, app: AppHandle) {
        if self.exiting.swap(true, Ordering::SeqCst) {
            return;
        }
        {
            self.inner.lock().unwrap().status.phase = "stopping".into();
        }
        self.emit(&app);
        let owned = self.clone();
        thread::spawn(move || {
            let deadline = Instant::now() + SHUTDOWN_TIMEOUT;
            let endpoint = {
                let mut inner = owned.inner.lock().unwrap();
                if let Some(process) = inner.child.as_mut() {
                    if let Some(stdin) = process.child.stdin.as_mut() {
                        let _ = stdin.write_all(b"ORDINE_EXECUTION_STOP\n");
                    }
                }
                inner
                    .status
                    .port
                    .map(|port| (port, inner.app_token.clone()))
            };
            if let Some((port, secret)) = endpoint {
                if let Ok(client) = reqwest::blocking::Client::builder()
                    .no_proxy()
                    .timeout(Duration::from_secs(2))
                    .build()
                {
                    let _ = client
                        .post(format!("http://127.0.0.1:{port}/api/v2/shutdown"))
                        .header("X-Desktop-Token", secret)
                        .header("X-Ordine-Api-Version", "2")
                        .json(&serde_json::json!({}))
                        .send();
                }
            }
            loop {
                let finished = {
                    let mut inner = owned.inner.lock().unwrap();
                    inner
                        .child
                        .as_mut()
                        .map(|process| !matches!(process.child.try_wait(), Ok(None)))
                        .unwrap_or(true)
                };
                if finished || Instant::now() >= deadline {
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
            {
                let mut inner = owned.inner.lock().unwrap();
                inner.child.take();
                inner.app_token.clear();
                inner.status.phase = "stopped".into();
            }
            owned.exit_complete.store(true, Ordering::SeqCst);
            app.exit(0);
        });
    }
}

#[tauri::command]
pub fn execution_status(state: tauri::State<'_, Arc<ExecutionSupervisor>>) -> Status {
    state.status()
}
#[tauri::command]
pub fn execution_credentials(
    state: tauri::State<'_, Arc<ExecutionSupervisor>>,
) -> Result<Credentials, String> {
    state.credentials()
}
#[tauri::command]
pub fn execution_retry(
    app: AppHandle,
    state: tauri::State<'_, Arc<ExecutionSupervisor>>,
    configuration: Option<DatabaseConfiguration>,
) -> Result<Status, String> {
    state.inner().start(app, configuration)
}
#[tauri::command]
pub fn execution_mcp_configuration(
    state: tauri::State<'_, Arc<ExecutionSupervisor>>,
) -> Result<serde_json::Value, String> {
    state.mcp_configuration()
}
