use tauri::State;

use crate::injection::clipboard::inject_text_via_clipboard;
use crate::injection::keyboard::inject_text_via_keyboard;
use crate::injection::windows;
use crate::injection::TargetWindow;
use crate::preferences::TextInjectionMethod;
use crate::AppState;

use super::CommandError;

#[tauri::command(rename_all = "camelCase")]
pub async fn inject_text(
    state: State<'_, AppState>,
    text: String,
    target_process_id: Option<u32>,
) -> Result<(), CommandError> {
    if text.is_empty() {
        return Ok(());
    }

    // If a target process ID was provided, activate that window first
    if let Some(pid) = target_process_id {
        windows::activate_window(pid)
            .map_err(|e| CommandError::new("TargetWindowNotFound", e))?;
    }

    let prefs = state
        .preferences
        .read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;

    // Drop the read lock before sleeping
    let injection_method = prefs.text_injection_method.clone();
    let clipboard_fallback = prefs.clipboard_fallback;
    drop(prefs);

    // Small delay to let any window activation settle
    std::thread::sleep(std::time::Duration::from_millis(50));

    let result = match injection_method {
        TextInjectionMethod::SimulatedKeystrokes => {
            inject_text_via_keyboard(&text)
        }
        TextInjectionMethod::ClipboardPaste => {
            inject_text_via_clipboard(&text)
        }
    };

    // If injection failed and clipboard fallback is enabled, try that
    if let Err(e) = result {
        if clipboard_fallback {
            eprintln!("[inject_text] Primary injection failed ({}), trying clipboard fallback", e);
            inject_text_via_clipboard(&text)
                .map_err(|e| CommandError::new("InjectionFailed", format!("Primary and clipboard fallback both failed: {}", e)))?;
        } else {
            return Err(CommandError::new("InjectionFailed", e));
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn list_windows() -> Result<Vec<TargetWindow>, CommandError> {
    windows::get_open_windows()
        .map_err(|e| CommandError::new("WindowEnumerationFailed", e))
}

#[tauri::command]
pub async fn copy_to_clipboard(text: String) -> Result<(), CommandError> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| CommandError::new("ClipboardError", format!("Failed to access clipboard: {}", e)))?;

    clipboard
        .set_text(text)
        .map_err(|e| CommandError::new("ClipboardError", format!("Failed to set clipboard text: {}", e)))?;

    Ok(())
}
