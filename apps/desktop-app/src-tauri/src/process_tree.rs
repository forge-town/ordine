use std::process::{Child, Command};

/// Owned by the native application, never the WebView. No breakaway flag is enabled.
pub struct ProcessTree {
    #[cfg(windows)]
    handle: usize,
    #[cfg(unix)]
    group: i32,
}

impl ProcessTree {
    pub fn configure(command: &mut Command) {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
    }

    pub fn attach(child: &Child) -> Result<Self, String> {
        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            use windows_sys::Win32::Foundation::CloseHandle;
            use windows_sys::Win32::System::JobObjects::*;
            // The server waits on stdin START until this assignment succeeds.
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() {
                    return Err("Could not create the Windows process job.".into());
                }
                let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
                limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let configured = SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &limits as *const _ as *const _,
                    std::mem::size_of_val(&limits) as u32,
                );
                if configured == 0 || AssignProcessToJobObject(handle, child.as_raw_handle()) == 0 {
                    CloseHandle(handle);
                    return Err(
                        "Could not contain the server process tree. Startup was refused.".into(),
                    );
                }
                Ok(Self {
                    handle: handle as usize,
                })
            }
        }
        #[cfg(unix)]
        {
            Ok(Self {
                group: child.id() as i32,
            })
        }
    }
}

impl Drop for ProcessTree {
    fn drop(&mut self) {
        #[cfg(windows)]
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.handle as _);
        }
        #[cfg(unix)]
        unsafe {
            libc::kill(-self.group, libc::SIGKILL);
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::os::windows::io::AsRawHandle;
    use std::process::Stdio;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn closing_job_terminates_the_real_child_and_grandchild() {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::Threading::{OpenProcess, WaitForSingleObject};
        let mut command = Command::new("powershell.exe");
        ProcessTree::configure(&mut command);
        command.args(["-NoProfile", "-NonInteractive", "-Command",
            "[Console]::ReadLine() | Out-Null; $worker = Start-Process -WindowStyle Hidden -FilePath 'ping.exe' -ArgumentList @('-n','60','127.0.0.1') -PassThru; [Console]::Out.WriteLine($worker.Id); Start-Sleep -Seconds 60"])
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        let mut child = command.spawn().expect("spawn test parent");
        let tree =
            ProcessTree::attach(&child).expect("contain test parent before allowing descendants");
        child.stdin.as_mut().unwrap().write_all(b"START\n").unwrap();
        let stdout = child.stdout.take().unwrap();
        let (sender, receiver) = mpsc::channel();
        std::thread::spawn(move || {
            let mut line = String::new();
            let result = BufReader::new(stdout).read_line(&mut line);
            let _ = sender.send(result.map(|_| line));
        });
        let pid = receiver
            .recv_timeout(Duration::from_secs(10))
            .expect("bounded descendant startup")
            .expect("read descendant pid")
            .trim()
            .parse::<u32>()
            .expect("numeric descendant pid");
        unsafe {
            let process = OpenProcess(0x00100000, 0, pid); // SYNCHRONIZE only
            assert!(
                !process.is_null(),
                "descendant must be alive before the job closes"
            );
            drop(tree);
            let signalled = WaitForSingleObject(process, 3000);
            CloseHandle(process);
            assert_eq!(signalled, 0, "closing native job must kill the descendant");
            assert_eq!(
                WaitForSingleObject(child.as_raw_handle(), 3000),
                0,
                "closing native job must also terminate the parent"
            );
        }
        // KILL_ON_JOB_CLOSE may use exit code 0; exit status does not prove graceful shutdown.
        child.wait().expect("reap terminated parent");
    }
}
