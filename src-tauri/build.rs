fn main() {
    // The release workflow sets this; updates look at that repo's releases.
    println!("cargo:rerun-if-env-changed=ESKY_UPDATE_REPO");
    tauri_build::build()
}
