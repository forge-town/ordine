// Keep native kernel/protocol tests independent of initializing a GUI application.
#[path = "../src/data_directory.rs"]
mod data_directory;
#[path = "../src/process_tree.rs"]
mod process_tree;
#[path = "../src/protocol.rs"]
mod protocol;
