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
