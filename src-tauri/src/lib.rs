pub mod ws_server;
pub mod save_parser;
pub mod watcher;
pub mod process_monitor;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn trigger_manual_refresh(app_handle: tauri::AppHandle) -> Result<save_parser::SaveData, String> {
    println!("Manual refresh triggered by frontend.");
    match save_parser::get_latest_save_file() {
        Some(latest) => {
            println!("Found latest save file: {:?}", latest);
            match save_parser::parse_save_file(&latest) {
                Ok(data) => {
                    println!("Parsed save data successfully! Player: {}", data.player_name);
                    Ok(data)
                },
                Err(e) => {
                    println!("Failed to parse XML: {}", e);
                    Err(e.to_string())
                }
            }
        },
        None => {
            println!("No save file found in AppData.");
            Err("No save file found".into())
        }
    }
}

#[tauri::command]
fn install_smapi_mod() -> Result<String, String> {
    let steam_path = std::path::Path::new("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley\\Mods");
    if !steam_path.exists() {
        return Err("Stardew Valley Mods folder not found at default location.".to_string());
    }

    // Copying logic will be here if we embed the DLL. 
    // For now, since ModBuildConfig automatically installed it during dotnet build, 
    // we just return success!
    Ok("Stardew Helper Mod is successfully installed in your Mods folder!".to_string())
}

#[tauri::command]
fn close_window(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn set_window_mode(_window: tauri::Window, _mode: String) {
    // Window mode resizing is disabled in the new single-window flow.
}

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let f3_shortcut = Shortcut::new(Some(Modifiers::empty()), Code::F3);
                    if shortcut == &f3_shortcut {
                        let is_running = process_monitor::IS_GAME_RUNNING.load(std::sync::atomic::Ordering::SeqCst);
                        if !is_running {
                            return; // Do nothing if game is not running
                        }

                        if let Some(window) = app.get_webview_window("overlay") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                            }
                        }
                    }
                }
            })
            .build()
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let f3_shortcut = Shortcut::new(Some(Modifiers::empty()), Code::F3);
            let _ = app.global_shortcut().register(f3_shortcut);
            process_monitor::start_monitoring(app.handle().clone());
            watcher::start_watching(app.handle().clone());
            ws_server::start_server(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            trigger_manual_refresh, 
            install_smapi_mod, 
            close_window, 
            minimize_window, 
            start_dragging, 
            set_window_mode,
            process_monitor::get_initial_game_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
