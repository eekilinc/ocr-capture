use image::{imageops, ImageBuffer, RgbaImage};
use screenshots::Screen;
use serde::Serialize;
use std::cmp;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureResponse {
    pub image_path: String,
    pub width: u32,
    pub height: u32,
    pub platform_note: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[tauri::command]
pub fn get_monitors() -> Result<Vec<MonitorInfo>, String> {
    let screens = Screen::all().map_err(|err| format!("Ekran listesi alinamadi: {err}"))?;

    let monitors = screens
        .iter()
        .enumerate()
        .map(|(index, screen)| MonitorInfo {
            id: index as u32,
            name: format!("Monitor {}", index + 1),
            x: screen.display_info.x,
            y: screen.display_info.y,
            width: screen.display_info.width,
            height: screen.display_info.height,
            is_primary: screen.display_info.is_primary,
        })
        .collect();

    Ok(monitors)
}

#[tauri::command]
pub fn capture_screen(monitor_id: Option<u32>) -> Result<CaptureResponse, String> {
    let screens = Screen::all().map_err(|err| format!("Ekran listesi alinamadi: {err}"))?;

    if screens.is_empty() {
        return Err(String::from("Hicbir ekran algilanmadi."));
    }

    let final_image: RgbaImage;
    let platform_note: String;

    // Eger spesifik bir monitor istenmisse onu yakala
    if let Some(id) = monitor_id {
        if let Some(screen) = screens.get(id as usize) {
            let captured_image = screen
                .capture()
                .map_err(|err| format!("Ekran {} yakalanamadi: {}", id, err))?;

            let width = captured_image.width();
            let height = captured_image.height();
            let raw_pixels = captured_image.into_raw();

            final_image = RgbaImage::from_raw(width, height, raw_pixels)
                .ok_or_else(|| String::from("Goruntu verisi islenemedi (Buffer olusturma hatasi)."))?;
            
            platform_note = format!("Monitor {} yakalandi.", id + 1);
        } else {
            return Err(format!("Monitor ID {} bulunamadi.", id));
        }
    } else {
        // Monitor ID belirtilmemisse TUM EKRANLARI BIRLESTIR
        let mut min_x = i32::MAX;
        let mut min_y = i32::MAX;
        let mut max_x = i32::MIN;
        let mut max_y = i32::MIN;

        for screen in &screens {
            min_x = cmp::min(min_x, screen.display_info.x);
            min_y = cmp::min(min_y, screen.display_info.y);
            max_x = cmp::max(max_x, screen.display_info.x + screen.display_info.width as i32);
            max_y = cmp::max(max_y, screen.display_info.y + screen.display_info.height as i32);
        }

        let total_width = (max_x - min_x) as u32;
        let total_height = (max_y - min_y) as u32;
        let mut combined = ImageBuffer::new(total_width, total_height);

        for screen in screens {
            if let Ok(captured) = screen.capture() {
                let w = captured.width();
                let h = captured.height();
                let pixels = captured.into_raw();
                if let Some(buf) = RgbaImage::from_raw(w, h, pixels) {
                    let rx = (screen.display_info.x - min_x) as i64;
                    let ry = (screen.display_info.y - min_y) as i64;
                    imageops::overlay(&mut combined, &buf, rx, ry);
                }
            }
        }
        final_image = combined;
        platform_note = String::from("Tum ekranlar birlestirildi.");
    }

    let path = crate::utils::temp_file_path("png")?;
    final_image.save(&path)
        .map_err(|err| format!("Goruntu kaydedilemedi: {err}"))?;

    Ok(CaptureResponse {
        image_path: path.to_string_lossy().to_string(),
        width: final_image.width(),
        height: final_image.height(),
        platform_note,
    })
}

