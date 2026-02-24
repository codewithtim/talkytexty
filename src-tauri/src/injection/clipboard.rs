use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

/// Inject text using clipboard paste (Cmd+V / Ctrl+V).
/// Saves and restores the previous clipboard content.
pub fn inject_text_via_clipboard(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new()
        .map_err(|e| format!("Failed to access clipboard: {}", e))?;

    // Save current clipboard content
    let previous = clipboard.get_text().ok();

    // Set new text
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard text: {}", e))?;

    // Small delay to ensure clipboard is ready
    std::thread::sleep(std::time::Duration::from_millis(50));

    // Simulate Cmd+V (macOS) or Ctrl+V (Windows/Linux)
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize keyboard simulator: {}", e))?;

    let modifier = if cfg!(target_os = "macos") {
        Key::Meta
    } else {
        Key::Control
    };

    enigo
        .key(modifier, Direction::Press)
        .map_err(|e| format!("Failed to press modifier: {}", e))?;
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| format!("Failed to press V: {}", e))?;
    enigo
        .key(modifier, Direction::Release)
        .map_err(|e| format!("Failed to release modifier: {}", e))?;

    // Small delay before restoring clipboard
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Restore previous clipboard content
    if let Some(prev) = previous {
        let _ = clipboard.set_text(prev);
    }

    Ok(())
}
