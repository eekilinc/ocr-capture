use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use which::which;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrInput {
    pub image_base64: String,
    pub languages: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OcrWord {
    pub text: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub conf: f32,
}

#[derive(Debug, Serialize)]
pub struct OcrResponse {
    pub text: String,
    pub engine: String,
    pub words: Vec<OcrWord>,
}

fn resolve_tesseract_binary() -> Result<PathBuf, String> {
    println!("DEBUG: Tesseract binary aranıyor...");
    if let Ok(path) = std::env::var("TESSERACT_PATH") {
        let explicit = PathBuf::from(path);
        if explicit.exists() {
            println!("DEBUG: TESSERACT_PATH bulundu: {:?}", explicit);
            return Ok(explicit);
        }
    }

    if let Ok(path) = which("tesseract") {
        println!("DEBUG: PATH icinde tesseract bulundu: {:?}", path);
        return Ok(path);
    }

    if cfg!(target_os = "windows") {
        let mut candidates = Vec::new();
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(local).join("Programs/Tesseract-OCR/tesseract.exe"));
        }
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            candidates.push(PathBuf::from(program_files).join("Tesseract-OCR/tesseract.exe"));
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(program_files_x86).join("Tesseract-OCR/tesseract.exe"));
        }
        // Common install location hardcoded just in case env vars are weird
        candidates.push(PathBuf::from(
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        ));
        candidates.push(PathBuf::from(
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ));

        for candidate in candidates {
            if candidate.exists() {
                println!(
                    "DEBUG: Windows konumunda tesseract bulundu: {:?}",
                    candidate
                );
                return Ok(candidate);
            }
        }
    }

    Err(String::from(
        "Tesseract bulunamadi. Lutfen Tesseract-OCR yukleyin ve PATH'e ekleyin veya TESSERACT_PATH ortam degiskenini ayarlayin.",
    ))
}

fn get_installed_languages(tesseract_bin: &PathBuf) -> HashSet<String> {
    let output = Command::new(tesseract_bin).arg("--list-langs").output();
    let Ok(out) = output else {
        return HashSet::new();
    };

    let text = String::from_utf8_lossy(&out.stdout);
    text.lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with("List of available languages"))
        .map(ToOwned::to_owned)
        .collect()
}

fn resolve_language_list(requested: &str, installed: &HashSet<String>) -> String {
    let available: Vec<String> = requested
        .split('+')
        .map(str::trim)
        .filter(|lang| !lang.is_empty())
        .filter(|lang| installed.contains(*lang))
        .map(ToOwned::to_owned)
        .collect();

    if !available.is_empty() {
        return available.join("+");
    }

    if installed.contains("eng") {
        return String::from("eng");
    }

    requested.to_string()
}

fn temp_png_path() -> Result<PathBuf, String> {
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("Saat bilgisi okunamadi: {err}"))?
        .as_millis();

    let mut path = std::env::temp_dir();
    path.push(format!("ocr-capture-{since_epoch}.png"));
    Ok(path)
}

#[tauri::command]
pub fn list_ocr_languages() -> Result<Vec<String>, String> {
    let tesseract_bin = resolve_tesseract_binary()?;
    let mut langs: Vec<String> = get_installed_languages(&tesseract_bin)
        .into_iter()
        .filter(|l| l != "osd" && l != "equ") // internal tesseract models, not real languages
        .collect();
    langs.sort();
    Ok(langs)
}

fn parse_tsv_words(tsv: &str) -> Vec<OcrWord> {
    tsv.lines()
        .skip(1) // header satırını atla
        .filter_map(|line| {
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() < 12 {
                return None;
            }
            let level: i32 = cols[0].parse().ok()?;
            if level != 5 {
                return None; // 5 = word level
            }
            let text = cols[11].trim().to_string();
            if text.is_empty() {
                return None;
            }
            Some(OcrWord {
                text,
                x: cols[6].parse().ok()?,
                y: cols[7].parse().ok()?,
                width: cols[8].parse().ok()?,
                height: cols[9].parse().ok()?,
                conf: cols[10].parse().unwrap_or(0.0),
            })
        })
        .collect()
}

#[tauri::command]
pub fn run_ocr(input: OcrInput) -> Result<OcrResponse, String> {
    let tesseract_bin = resolve_tesseract_binary()?;
    let png_path = temp_png_path()?;
    let image_bytes = STANDARD
        .decode(input.image_base64)
        .map_err(|err| format!("Base64 veri cozulmedi: {err}"))?;

    fs::write(&png_path, image_bytes).map_err(|err| format!("Gecici dosya yazilamadi: {err}"))?;

    let requested_lang = input.languages.unwrap_or_else(|| String::from("tur+eng"));
    let installed_langs = get_installed_languages(&tesseract_bin);
    let lang = resolve_language_list(&requested_lang, &installed_langs);

    // KULLANICIYA UYARI: Eger Turkce istendi ama yoksa
    if requested_lang.contains("tur") && !installed_langs.contains("tur") {
        println!("UYARI: Turkce dil paketi (tur.traineddata) Tesseract klasorunde bulunamadi.");
        println!(
            "Lutfen su adresten 'tur.traineddata' dosyasini indirip 'tessdata' klasorune atin:"
        );
        println!("https://github.com/tesseract-ocr/tessdata");
    }

    let output = Command::new(&tesseract_bin)
        .arg(&png_path)
        .arg("stdout")
        .arg("-l")
        .arg(&lang)
        .output()
        .map_err(|err| {
            format!(
                "Tesseract calistirilamadi: {err}. TESSERACT_PATH veya PATH ayarlarini kontrol et."
            )
        })?;

    // TSV pass for word bounding boxes
    let tsv_result = Command::new(&tesseract_bin)
        .arg(&png_path)
        .arg("stdout")
        .arg("-l")
        .arg(&lang)
        .arg("tsv")
        .output();

    let _ = fs::remove_file(&png_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        println!("OCR HATA: {}", stderr);
        return Err(if stderr.is_empty() {
            String::from("OCR islemi basarisiz oldu. (Cikis kodu hatali)")
        } else {
            format!("OCR islemi basarisiz oldu: {stderr}")
        });
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        println!("UYARI: OCR metin bulamadi.");
    } else {
        println!("OCR BASARILI: {} karakter okundu.", text.len());
    }

    let words = match tsv_result {
        Ok(tsv_output) if tsv_output.status.success() => {
            let tsv_text = String::from_utf8_lossy(&tsv_output.stdout).to_string();
            parse_tsv_words(&tsv_text)
        }
        _ => vec![],
    };

    Ok(OcrResponse {
        text,
        engine: format!("{} ({lang})", tesseract_bin.display()),
        words,
    })
}
