use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn temp_file_path(extension: &str) -> Result<PathBuf, String> {
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("Saat bilgisi okunamadi: {err}"))?
        .as_millis();

    let mut path = std::env::temp_dir();
    let file_name = if extension.is_empty() {
        format!("ocr-capture-{}", since_epoch)
    } else {
        format!("ocr-capture-{}.{}", since_epoch, extension)
    };
    path.push(file_name);
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_temp_file_path() {
        let path = temp_file_path("png").unwrap();
        assert!(path.to_string_lossy().contains("ocr-capture-"));
        assert!(path.to_string_lossy().ends_with(".png"));
    }
}
