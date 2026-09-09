use std::path::{Component, Path, PathBuf};

fn resolved_destination(path: &Path) -> Result<PathBuf, String> {
    let ancestor = path
        .ancestors()
        .find(|candidate| candidate.exists())
        .ok_or("The v2 data directory has no accessible parent.")?;
    let parent = std::fs::canonicalize(ancestor)
        .map_err(|_| "The v2 data directory parent could not be verified.")?;
    Ok(parent.join(
        path.strip_prefix(ancestor)
            .map_err(|_| "Invalid v2 data directory.")?,
    ))
}

/// Resolve the existing parent before writing anything, including directory junctions/symlinks.
pub(crate) fn validate_data_directory(data: &Path, home: &Path) -> Result<(), String> {
    if !data.is_absolute()
        || data
            .components()
            .any(|component| component == Component::ParentDir)
    {
        return Err(
            "Execution v2 requires its own absolute data directory without parent traversal."
                .into(),
        );
    }
    let destination = resolved_destination(data)?;
    let legacy_root = resolved_destination(&home.join(".ordine"))?;
    let legacy_data = resolved_destination(&home.join(".ordine/data"))?;
    if destination == legacy_root || destination.starts_with(legacy_data) {
        return Err(
            "Execution v2 cannot use the legacy Ordine data directory or its descendants.".into(),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn old_data_and_parent_traversal_are_refused_without_writes() {
        let home = std::env::temp_dir().join(format!("ordine-r10-path-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(home.join(".ordine/data")).unwrap();
        assert!(validate_data_directory(&home.join(".ordine"), &home).is_err());
        assert!(validate_data_directory(&home.join(".ordine/data/new"), &home).is_err());
        assert!(validate_data_directory(&home.join(".ordine/v2/../data"), &home).is_err());
        assert!(validate_data_directory(&home.join(".ordine/v2"), &home).is_ok());
        assert!(!home.join(".ordine/v2").exists());
    }
}
