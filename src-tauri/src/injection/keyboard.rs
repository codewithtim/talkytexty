use enigo::{Enigo, Keyboard, Settings};

/// Inject text into the currently focused application using simulated keystrokes.
pub fn inject_text_via_keyboard(text: &str) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize keyboard simulator: {}", e))?;

    enigo
        .text(text)
        .map_err(|e| format!("Failed to inject text via keyboard: {}", e))?;

    Ok(())
}

/// Press a specific key (e.g. "Enter", "Backspace", "Tab").
pub fn press_key_via_keyboard(key_name: &str) -> Result<(), String> {
    use enigo::Key;

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize keyboard simulator: {}", e))?;

    let key = match key_name.to_lowercase().as_str() {
        "enter" | "return" => Key::Return,
        "tab" => Key::Tab,
        "backspace" => Key::Backspace,
        "space" => Key::Space,
        "escape" | "esc" => Key::Escape,
        "up" | "uparrow" => Key::UpArrow,
        "down" | "downarrow" => Key::DownArrow,
        "left" | "leftarrow" => Key::LeftArrow,
        "right" | "rightarrow" => Key::RightArrow,
        _ => return Err(format!("Unsupported key: {}", key_name)),
    };

    enigo
        .key(key, enigo::Direction::Click)
        .map_err(|e| format!("Failed to press key {}: {}", key_name, e))?;

    Ok(())
}

/// Delete the previous word in the focused application.
/// Uses Option+Backspace on macOS, Ctrl+Backspace on Windows/Linux.
pub fn delete_previous_word_via_keyboard() -> Result<(), String> {
    use enigo::{Key, Keyboard, Direction};

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize keyboard simulator: {}", e))?;

    #[cfg(target_os = "macos")]
    let modifier = Key::Option;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;

    enigo.key(modifier, Direction::Press).map_err(|e| e.to_string())?;
    enigo.key(Key::Backspace, Direction::Click).map_err(|e| e.to_string())?;
    enigo.key(modifier, Direction::Release).map_err(|e| e.to_string())?;

    Ok(())
}
