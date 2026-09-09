mod data_directory;
mod execution;
mod process_tree;
mod protocol;
use execution::*;
use std::sync::{atomic::Ordering, Arc};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let application = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            execution_status,
            execution_credentials,
            execution_retry,
            execution_mcp_configuration
        ])
        .setup(|app| {
            let supervisor =
                ExecutionSupervisor::new(app.handle()).map_err(std::io::Error::other)?;
            app.manage(supervisor.clone());
            let _ = supervisor.start(app.handle().clone(), None);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<Arc<ExecutionSupervisor>>();
                if !state.exit_complete.load(Ordering::SeqCst) {
                    api.prevent_close();
                    state.inner().begin_exit(window.app_handle().clone());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");
    application.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            let state = app.state::<Arc<ExecutionSupervisor>>();
            if !state.exit_complete.load(Ordering::SeqCst) {
                api.prevent_exit();
                state.inner().begin_exit(app.clone());
            }
        }
    });
}
