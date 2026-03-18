use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::codecs::png::PngEncoder;
use image::ColorType;
use image::{imageops, ImageBuffer, ImageEncoder, RgbaImage};
use screenshots::Screen;
use serde::Serialize;
use std::cmp;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureResponse {
    pub image_base64: String,
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

    // Fix missing scope due to early return
    // Need to add back the logic for single monitor

    // Eger spesifik bir monitor istenmisse onu yakala ve don
    if let Some(id) = monitor_id {
        // screens zaten yukarida tanimli
        if let Some(screen) = screens.get(id as usize) {
            let captured_image = screen
                .capture()
                .map_err(|err| format!("Ekran {} yakalanamadi: {}", id, err))?;

            let width = captured_image.width();
            let height = captured_image.height();

            // Raw data'yi al
            let raw_pixels = captured_image.into_raw();

            // ImageBuffer olustur
            if let Some(img_buffer) = RgbaImage::from_raw(width, height, raw_pixels) {
                let mut bytes = Vec::new();
                PngEncoder::new(&mut bytes)
                    .write_image(&img_buffer, width, height, ColorType::Rgba8.into())
                    .map_err(|err| format!("Goruntu PNG'ye cevrilemedi: {err}"))?;

                return Ok(CaptureResponse {
                    image_base64: STANDARD.encode(bytes),
                    width,
                    height,
                    platform_note: format!("Monitor {} yakalandi.", id + 1),
                });
            } else {
                return Err(String::from(
                    "Goruntu verisi islenemedi (Buffer olusturma hatasi).",
                ));
            }
        } else {
            return Err(format!("Monitor ID {} bulunamadi.", id));
        }
    }

    // Monitor ID belirtilmemisse TUM EKRANLARI BIRLESTIR
    let screen_count = screens.len();

    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;

    for screen in &screens {
        min_x = cmp::min(min_x, screen.display_info.x);
        min_y = cmp::min(min_y, screen.display_info.y);
        max_x = cmp::max(
            max_x,
            screen.display_info.x + screen.display_info.width as i32,
        );
        max_y = cmp::max(
            max_y,
            screen.display_info.y + screen.display_info.height as i32,
        );
    }

    let total_width = (max_x - min_x) as u32;
    let total_height = (max_y - min_y) as u32;

    let mut combined_image: RgbaImage = ImageBuffer::new(total_width, total_height);

    for screen in screens {
        let captured_image = screen
            .capture()
            .map_err(|err| format!("Ekran {} yakalanamadi: {}", screen.display_info.id, err))?;

        let width = captured_image.width();
        let height = captured_image.height();
        let raw_pixels = captured_image.into_raw();

        if let Some(img_buffer) = RgbaImage::from_raw(width, height, raw_pixels) {
            let relative_x = (screen.display_info.x - min_x) as i64;
            let relative_y = (screen.display_info.y - min_y) as i64;

            imageops::overlay(&mut combined_image, &img_buffer, relative_x, relative_y);
        }
    }

    let mut bytes = Vec::new();
    PngEncoder::new(&mut bytes)
        .write_image(
            &combined_image,
            total_width,
            total_height,
            ColorType::Rgba8.into(),
        )
        .map_err(|err| format!("Birlestirilmis goruntu PNG'ye cevrilemedi: {err}"))?;

    let platform_note = if screen_count > 1 {
        format!(
            "{} ekran birlestirildi. Genis tuval uzerinde secim yapabilirsiniz.",
            screen_count
        )
    } else {
        String::new()
    };

    Ok(CaptureResponse {
        image_base64: STANDARD.encode(bytes),
        width: total_width,
        height: total_height,
        platform_note,
    })
}
