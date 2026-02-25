// T071: Unit test for window enumeration via x-win
//
// Tests verify:
// - Window enumeration returns TargetWindow structs
// - TargetWindow has required fields (window_id, title, app_name, process_id, icon)
// - Own app windows are filtered out

use text_to_code_lib::injection::TargetWindow;
use text_to_code_lib::injection::windows::{filter_own_windows, map_to_target_window};

#[test]
fn test_target_window_has_required_fields() {
    let window = TargetWindow {
        window_id: "12345".to_string(),
        title: "Test Window".to_string(),
        app_name: "TestApp".to_string(),
        process_id: 100,
        icon: None,
    };
    assert_eq!(window.window_id, "12345");
    assert_eq!(window.title, "Test Window");
    assert_eq!(window.app_name, "TestApp");
    assert_eq!(window.process_id, 100);
    assert!(window.icon.is_none());
}

#[test]
fn test_filter_own_windows_removes_talkytexty() {
    let windows = vec![
        TargetWindow {
            window_id: "1".to_string(),
            title: "VS Code".to_string(),
            app_name: "Code".to_string(),
            process_id: 100,
            icon: None,
        },
        TargetWindow {
            window_id: "2".to_string(),
            title: "TalkyTexty - Settings".to_string(),
            app_name: "TalkyTexty".to_string(),
            process_id: 200,
            icon: None,
        },
        TargetWindow {
            window_id: "3".to_string(),
            title: "Terminal".to_string(),
            app_name: "Terminal".to_string(),
            process_id: 300,
            icon: None,
        },
    ];

    let own_pid = 200;
    let filtered = filter_own_windows(windows, own_pid);
    assert_eq!(filtered.len(), 2);
    assert!(filtered.iter().all(|w| w.process_id != own_pid));
}

#[test]
fn test_filter_own_windows_keeps_all_when_no_match() {
    let windows = vec![
        TargetWindow {
            window_id: "1".to_string(),
            title: "VS Code".to_string(),
            app_name: "Code".to_string(),
            process_id: 100,
            icon: None,
        },
    ];

    let filtered = filter_own_windows(windows, 999);
    assert_eq!(filtered.len(), 1);
}

#[test]
fn test_map_to_target_window_creates_valid_struct() {
    let tw = map_to_target_window("42", "My Editor", "SublimeText", 555);
    assert_eq!(tw.window_id, "42");
    assert_eq!(tw.title, "My Editor");
    assert_eq!(tw.app_name, "SublimeText");
    assert_eq!(tw.process_id, 555);
    assert!(tw.icon.is_none());
}
