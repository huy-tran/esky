//! Text in an image, through `tesseract` when it's installed.

use super::util;

pub fn read(path: &str) -> Result<String, String> {
    if util::find("tesseract").is_none() {
        return Err("Install tesseract (pacman -S tesseract tesseract-data-eng) to read text in images".into());
    }
    util::run("tesseract", &[path, "stdout"])
}
