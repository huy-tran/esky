//! Text from an image (Clipboard History → Copy Text from Image), with Windows' own OCR engine
//! in the languages installed for your account. Nothing leaves this PC.

use windows::core::HSTRING;
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::{FileAccessMode, StorageFile};

fn err(e: windows::core::Error) -> String {
    e.message().to_string()
}

/// The text Windows reads in the PNG at `path`, one line per line it found.
pub fn read(path: &str) -> Result<String, String> {
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path)).map_err(err)?.join().map_err(err)?;
    let stream = file.OpenAsync(FileAccessMode::Read).map_err(err)?.join().map_err(err)?;
    let decoder = BitmapDecoder::CreateAsync(&stream).map_err(err)?.join().map_err(err)?;
    let bitmap = decoder.GetSoftwareBitmapAsync().map_err(err)?.join().map_err(err)?;
    let engine = OcrEngine::TryCreateFromUserProfileLanguages().map_err(|_| "Windows has no text recognition for your languages. Add one in Settings → Time & language → Language.".to_string())?;
    let max = OcrEngine::MaxImageDimension().map_err(err)?;
    if bitmap.PixelWidth().map_err(err)? as u32 > max || bitmap.PixelHeight().map_err(err)? as u32 > max {
        return Err(format!("The image is too large to read (over {max} pixels)"));
    }
    let result = engine.RecognizeAsync(&bitmap).map_err(err)?.join().map_err(err)?;
    let lines: Vec<String> = result.Lines().map_err(err)?.into_iter().filter_map(|l| l.Text().ok().map(|t| t.to_string())).collect();
    Ok(lines.join("\n"))
}
