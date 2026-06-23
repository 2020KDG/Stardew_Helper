use tauri::Emitter;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::StreamExt;

pub fn start_server(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let addr = "127.0.0.1:8765";
        let listener = TcpListener::bind(&addr).await.expect("Failed to bind to 8765");
        println!("WebSocket Server listening on: {}", addr);

        while let Ok((stream, _)) = listener.accept().await {
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(mut ws_stream) = accept_async(stream).await {
                    println!("SMAPI Mod connected to WebSocket!");
                    while let Some(msg) = ws_stream.next().await {
                        match msg {
                            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                // Parse string as JSON and emit to frontend
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                    let _ = app_handle_clone.emit("save-updated", json);
                                }
                            }
                            _ => {}
                        }
                    }
                    println!("SMAPI Mod disconnected.");
                }
            });
        }
    });
}
