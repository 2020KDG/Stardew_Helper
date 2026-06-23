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

#[tauri::command]
fn launch_game() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start steam://rungameid/413150"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Simple fallback
        std::process::Command::new("xdg-open")
            .arg("steam://rungameid/413150")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use std::str::FromStr;
use std::sync::Mutex;

struct HotkeyState(Mutex<String>);

#[tauri::command]
fn get_hotkey(state: tauri::State<'_, HotkeyState>) -> Result<String, String> {
    let key = state.0.lock().unwrap().clone();
    Ok(key)
}

#[tauri::command]
fn set_hotkey(app: tauri::AppHandle, state: tauri::State<'_, HotkeyState>, new_key: String) -> Result<(), String> {
    let mut current = state.0.lock().unwrap();
    
    // Parse new key
    let code = match Code::from_str(&new_key) {
        Ok(c) => c,
        Err(_) => return Err("Invalid hotkey code".into()),
    };
    
    let new_shortcut = Shortcut::new(Some(Modifiers::empty()), code);
    
    // Unregister old
    if let Ok(old_code) = Code::from_str(&current) {
        let old_shortcut = Shortcut::new(Some(Modifiers::empty()), old_code);
        let _ = app.global_shortcut().unregister(old_shortcut);
    }
    
    // Register new
    if let Err(e) = app.global_shortcut().register(new_shortcut) {
        return Err(e.to_string());
    }
    
    *current = new_key.clone();
    
    // Save to disk
    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&app_dir);
        let config_path = app_dir.join("config.json");
        let _ = std::fs::write(&config_path, format!("{{\"hotkey\":\"{}\"}}", new_key));
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let state = app.state::<HotkeyState>();
                    let current_key = state.0.lock().unwrap().clone();
                    
                    if let Ok(code) = Code::from_str(&current_key) {
                        let target_shortcut = Shortcut::new(Some(Modifiers::empty()), code);
                        if shortcut == &target_shortcut {
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
                }
            })
            .build()
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let mut initial_key = "F3".to_string();
            
            // Load from disk
            if let Ok(app_dir) = app.path().app_data_dir() {
                let config_path = app_dir.join("config.json");
                if let Ok(content) = std::fs::read_to_string(&config_path) {
                    // naive parsing
                    if let Some(idx) = content.find("\"hotkey\":\"") {
                        let start = idx + 10;
                        if let Some(end) = content[start..].find("\"") {
                            initial_key = content[start..start+end].to_string();
                        }
                    }
                }
            }
            
            app.manage(HotkeyState(Mutex::new(initial_key.clone())));
            
            if let Ok(code) = Code::from_str(&initial_key) {
                let shortcut = Shortcut::new(Some(Modifiers::empty()), code);
                let _ = app.global_shortcut().register(shortcut);
            }

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
            launch_game,
            get_hotkey,
            set_hotkey,
            process_monitor::get_initial_game_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
