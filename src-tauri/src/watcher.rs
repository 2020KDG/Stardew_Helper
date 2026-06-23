use crate::save_parser::{get_latest_save_file, parse_save_file};
use notify::{RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start_watching(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let app_data = match std::env::var("APPDATA") {
            Ok(val) => val,
            Err(_) => return,
        };
        let saves_dir = PathBuf::from(app_data).join("StardewValley").join("Saves");

        if !saves_dir.exists() {
            println!("Saves directory not found: {:?}", saves_dir);
            // Optionally emit an event to frontend
            return;
        }

        let (tx, rx) = channel();

        // notify 8.x
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                println!("Failed to create watcher: {:?}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&saves_dir, RecursiveMode::Recursive) {
            println!("Failed to watch directory: {:?}", e);
            return;
        }

        println!("Started watching: {:?}", saves_dir);

        // 초기 데이터 로드 및 전송
        if let Some(latest) = get_latest_save_file() {
            if let Ok(data) = parse_save_file(&latest) {
                let _ = app_handle.emit("save-updated", data);
            }
        }

        // debounce 적용 로직 (같은 저장에 여러 번 이벤트가 오는 것을 방지)
        let mut last_event_time = std::time::Instant::now();

        loop {
            match rx.recv() {
                Ok(event_result) => {
                    if let Ok(event) = event_result {
                        // Modify 류의 이벤트가 발생했을 때
                        if event.kind.is_modify() {
                            // SMAPI 모드일 때는 무거운 파일 시스템 파싱을 무시합니다.
                            if crate::process_monitor::IS_SMAPI_MODE
                                .load(std::sync::atomic::Ordering::SeqCst)
                            {
                                continue;
                            }

                            if last_event_time.elapsed() > Duration::from_millis(500) {
                                last_event_time = std::time::Instant::now();
                                std::thread::sleep(Duration::from_millis(100)); // 파일 쓰기 완료 대기

                                if let Some(latest) = get_latest_save_file() {
                                    if let Ok(data) = parse_save_file(&latest) {
                                        println!("Save updated, emitting data...");
                                        let _ = app_handle.emit("save-updated", data);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Watch error: {:?}", e);
                    break;
                }
            }
        }
    });
}
