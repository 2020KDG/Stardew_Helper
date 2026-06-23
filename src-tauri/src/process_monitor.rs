use lazy_static::lazy_static;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use sysinfo::System;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

lazy_static! {
    pub static ref IS_SMAPI_MODE: AtomicBool = AtomicBool::new(false);
    pub static ref IS_GAME_RUNNING: AtomicBool = AtomicBool::new(false);
}

#[tauri::command]
pub fn get_initial_game_state() -> String {
    if IS_SMAPI_MODE.load(Ordering::SeqCst) {
        "SMAPI".to_string()
    } else if IS_GAME_RUNNING.load(Ordering::SeqCst) {
        "Vanilla".to_string()
    } else {
        "None".to_string()
    }
}

pub fn start_monitoring(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_mode = String::new();
        let mut has_notified_mod_missing = false;

        loop {
            // Create a fresh system instance to guarantee we see newly launched processes
            let sys = System::new_all();

            let mut is_smapi = false;
            let mut is_vanilla = false;

            for process in sys.processes().values() {
                let name = process.name().to_string_lossy().to_lowercase();
                if name.contains("stardewmoddingapi") || name.contains("smapi") {
                    is_smapi = true;
                    break; // SMAPI takes precedence
                } else if name == "stardew valley.exe"
                    || name == "stardew valley"
                    || name == "stardewvalley"
                    || name == "stardewvalley.exe"
                {
                    is_vanilla = true;
                }
            }

            if is_smapi {
                use crate::AppState;
                use tauri::Manager;

                let state = app_handle.state::<AppState>();
                let config = state.0.lock().unwrap().clone();
                let game_path = std::path::Path::new(&config.game_path);
                let dll_path = game_path
                    .join("Mods")
                    .join("StardewHelperMod")
                    .join("StardewHelperMod.dll");

                if !dll_path.exists() {
                    // Downgrade to Vanilla if mod is not installed
                    is_smapi = false;
                    is_vanilla = true;

                    if !has_notified_mod_missing {
                        has_notified_mod_missing = true;
                        let _ = app_handle.emit("recommend-mod-install", ());
                    }
                } else {
                    // Reset the notification flag if the mod is installed and running
                    has_notified_mod_missing = false;
                }
            } else if !is_vanilla {
                // Game is not running at all, reset the flag so they get notified again on next launch
                has_notified_mod_missing = false;
            }

            let current_mode = if is_smapi {
                "SMAPI"
            } else if is_vanilla {
                "Vanilla"
            } else {
                "None"
            };

            // Update global state
            IS_SMAPI_MODE.store(is_smapi, Ordering::SeqCst);
            IS_GAME_RUNNING.store(is_smapi || is_vanilla, Ordering::SeqCst);

            // Log and emit only on change to prevent console spam and frontend focus stealing
            if current_mode != last_mode {
                last_mode = current_mode.to_string();
                println!("Game state changed to: {}", current_mode);
                let _ = app_handle.emit("game-state-changed", current_mode);
            }

            sleep(Duration::from_secs(2)).await;
        }
    });
}
