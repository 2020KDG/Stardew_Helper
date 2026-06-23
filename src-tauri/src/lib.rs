pub mod process_monitor;
pub mod save_parser;
pub mod watcher;
pub mod ws_server;

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
                    println!(
                        "Parsed save data successfully! Player: {}",
                        data.player_name
                    );
                    Ok(data)
                }
                Err(e) => {
                    println!("Failed to parse XML: {}", e);
                    Err(e.to_string())
                }
            }
        }
        None => {
            println!("No save file found in AppData.");
            Err("No save file found".into())
        }
    }
}

use serde::{Deserialize, Serialize};

fn default_launch_mode() -> String {
    "Vanilla".to_string()
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub hotkey: String,
    pub game_path: String,
    #[serde(default = "default_launch_mode")]
    pub launch_mode: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hotkey: "F3".to_string(),
            game_path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley"
                .to_string(),
            launch_mode: "Vanilla".to_string(),
        }
    }
}

pub struct AppState(pub Mutex<AppConfig>);

#[tauri::command]
fn install_smapi_mod(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let config = state.0.lock().unwrap().clone();
    let game_path = std::path::Path::new(&config.game_path);
    if !game_path.exists() {
        return Err("설정된 스타듀밸리 경로를 찾을 수 없습니다.".to_string());
    }

    let mods_path = game_path.join("Mods");
    if !mods_path.exists() {
        if let Err(_) = std::fs::create_dir_all(&mods_path) {
            return Err("Mods 폴더를 생성할 수 없습니다.".to_string());
        }
    }

    let dest_mod_path = mods_path.join("StardewHelperMod");
    if !dest_mod_path.exists() {
        if let Err(_) = std::fs::create_dir_all(&dest_mod_path) {
            return Err("StardewHelperMod 폴더를 생성할 수 없습니다.".to_string());
        }
    }

    let resource_path = app
        .path()
        .resolve(
            "resources/StardewHelperMod",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|_| "리소스를 찾을 수 없습니다.".to_string())?;

    if resource_path.exists() {
        let manifest_src = resource_path.join("manifest.json");
        let manifest_dest = dest_mod_path.join("manifest.json");
        let _ = std::fs::copy(manifest_src, manifest_dest);

        let dll_src = resource_path.join("StardewHelperMod.dll");
        let dll_dest = dest_mod_path.join("StardewHelperMod.dll");
        let _ = std::fs::copy(dll_src, dll_dest);

        Ok("Stardew Helper Mod가 성공적으로 설치되었습니다!".to_string())
    } else {
        Err("설치할 모드 파일이 앱 내부에 존재하지 않습니다.".to_string())
    }
}

#[tauri::command]
fn check_mod_installed(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let config = state.0.lock().unwrap().clone();
    let game_path = std::path::Path::new(&config.game_path);
    if !game_path.exists() {
        return Ok(false);
    }
    let dll_path = game_path
        .join("Mods")
        .join("StardewHelperMod")
        .join("StardewHelperMod.dll");
    Ok(dll_path.exists())
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
fn launch_game(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let config = state.0.lock().unwrap().clone();
    let game_path = std::path::Path::new(&config.game_path);

    if !game_path.exists() {
        return Err(
            "설정된 게임 경로가 올바르지 않습니다. 설정 탭에서 경로를 지정해주세요.".to_string(),
        );
    }

    let exe_name = if config.launch_mode == "SMAPI" {
        "StardewModdingAPI.exe"
    } else {
        "Stardew Valley.exe"
    };

    let exe_path = game_path.join(exe_name);
    if !exe_path.exists() {
        // Fallback to steam protocol if exe not found
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd")
                .args(["/C", "start steam://rungameid/413150"])
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
        #[cfg(not(target_os = "windows"))]
        return Err(format!("실행 파일을 찾을 수 없습니다: {}", exe_name));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&exe_path)
            .current_dir(game_path)
            .spawn()
            .map_err(|e| format!("게임 실행 실패: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(&exe_path)
            .current_dir(game_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

use std::str::FromStr;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn get_config(state: tauri::State<'_, AppState>) -> Result<AppConfig, String> {
    Ok(state.0.lock().unwrap().clone())
}

#[tauri::command]
fn save_config(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    new_config: AppConfig,
) -> Result<(), String> {
    let mut current = state.0.lock().unwrap();

    if current.hotkey != new_config.hotkey {
        if let Ok(code) = Code::from_str(&new_config.hotkey) {
            let new_shortcut = Shortcut::new(Some(Modifiers::empty()), code);
            if let Ok(old_code) = Code::from_str(&current.hotkey) {
                let old_shortcut = Shortcut::new(Some(Modifiers::empty()), old_code);
                let _ = app.global_shortcut().unregister(old_shortcut);
            }
            if let Err(e) = app.global_shortcut().register(new_shortcut) {
                return Err(e.to_string());
            }
        }
    }

    *current = new_config.clone();

    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&app_dir);
        let config_path = app_dir.join("config.json");
        if let Ok(json) = serde_json::to_string(&new_config) {
            let _ = std::fs::write(&config_path, json);
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let state = app.state::<AppState>();
                        let current_key = state.0.lock().unwrap().hotkey.clone();

                        if let Ok(code) = Code::from_str(&current_key) {
                            let target_shortcut = Shortcut::new(Some(Modifiers::empty()), code);
                            if shortcut == &target_shortcut {
                                let is_running = process_monitor::IS_GAME_RUNNING
                                    .load(std::sync::atomic::Ordering::SeqCst);
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
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let mut config = AppConfig::default();

            // Load from disk
            if let Ok(app_dir) = app.path().app_data_dir() {
                let config_path = app_dir.join("config.json");
                if let Ok(content) = std::fs::read_to_string(&config_path) {
                    if let Ok(parsed) = serde_json::from_str::<AppConfig>(&content) {
                        config = parsed;
                    } else {
                        // fallback
                        if let Some(idx) = content.find("\"hotkey\":\"") {
                            let start = idx + 10;
                            if let Some(end) = content[start..].find("\"") {
                                config.hotkey = content[start..start + end].to_string();
                            }
                        }
                    }
                }
            }

            let initial_key = config.hotkey.clone();
            app.manage(AppState(Mutex::new(config)));

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
            get_config,
            save_config,
            check_mod_installed,
            process_monitor::get_initial_game_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
