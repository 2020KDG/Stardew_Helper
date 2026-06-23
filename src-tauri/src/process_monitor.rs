use sysinfo::System;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;
use lazy_static::lazy_static;

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
                } else if name == "stardew valley.exe" || name == "stardew valley" || name == "stardewvalley" || name == "stardewvalley.exe" {
                    is_vanilla = true;
                }
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
