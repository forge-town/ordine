use std::{io::Read, sync::mpsc};
pub(crate) fn token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| "Secure token generation failed.")?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

// Fixed-size buffering. All non-readiness output is discarded instead of logging secrets/SQL.
pub(crate) fn read_ready(mut input: impl Read, sender: mpsc::SyncSender<serde_json::Value>) {
    let mut chunk = [0u8; 1024];
    let mut line = Vec::with_capacity(4096);
    let mut oversized = false;
    while let Ok(count) = input.read(&mut chunk) {
        if count == 0 {
            break;
        }
        for byte in &chunk[..count] {
            if *byte == b'\n' {
                if !oversized {
                    if let Some(json) = line.strip_prefix(b"ORDINE_EXECUTION_READY ") {
                        if let Ok(value) = serde_json::from_slice(json) {
                            let _ = sender.try_send(value);
                        }
                    }
                }
                line.clear();
                oversized = false;
            } else if line.len() < 4096 {
                line.push(*byte);
            } else {
                oversized = true;
            }
        }
    }
}

pub(crate) fn discard_output(mut input: impl Read) {
    let mut chunk = [0u8; 4096];
    while let Ok(count) = input.read(&mut chunk) {
        if count == 0 {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn readiness_reader_discards_large_and_unstructured_output() {
        let mut output = vec![b'x'; 100_000];
        output.extend_from_slice(b"\nsecret credentials must never become an event\n");
        output.extend_from_slice(b"ORDINE_EXECUTION_READY {\"apiVersion\":2,\"port\":19433}\n");
        let (sender, receiver) = mpsc::sync_channel(1);
        read_ready(std::io::Cursor::new(output), sender);
        assert_eq!(
            receiver.recv().unwrap(),
            serde_json::json!({"apiVersion":2,"port":19433})
        );
        assert!(receiver.try_recv().is_err());
    }
    #[test]
    fn generated_credentials_have_independent_256_bit_values() {
        let app = token().unwrap();
        let agent = token().unwrap();
        assert_eq!(app.len(), 64);
        assert_eq!(agent.len(), 64);
        assert_ne!(app, agent);
    }
}
