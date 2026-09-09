fn main() {
    println!(
        "cargo:rustc-env=ORDINE_BUILD_TARGET={}",
        std::env::var("TARGET").unwrap()
    );
    // MinGW windres cannot read a non-ASCII icon path. OUT_DIR can be placed on an
    // ASCII CARGO_TARGET_DIR without moving or rewriting the user's repository.
    let icon = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("ordine-icon.ico");
    std::fs::copy("icons/icon.ico", &icon).expect("copy build icon");
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new().window_icon_path(icon)),
    )
    .expect("build Tauri resources");
}
