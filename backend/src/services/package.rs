use std::process::Command;

use crate::config::PackageConfig;
use crate::models::{OperationResult, PackageStatus};

pub fn get_status(config: &PackageConfig) -> PackageStatus {
    let name = &config.name;
    let installed_version = get_installed_version(name);
    let latest_version = get_latest_version(name);

    PackageStatus {
        name: name.clone(),
        installed: installed_version.is_some(),
        installed_version,
        latest_version,
    }
}

pub fn install(config: &PackageConfig) -> OperationResult {
    let name = &config.name;
    let cmd = config
        .install_command
        .clone()
        .unwrap_or_else(|| format!("npm install -g {name}"));

    run_npm_command("install", &cmd)
}

pub fn update(config: &PackageConfig) -> OperationResult {
    let name = &config.name;
    let cmd = format!("npm update -g {name}");
    run_npm_command("update", &cmd)
}

fn run_npm_command(operation: &str, cmd: &str) -> OperationResult {
    let output = Command::new("sh").arg("-c").arg(cmd).output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let combined = format!("{stdout}\n{stderr}").trim().to_string();

            OperationResult {
                operation: operation.to_string(),
                success: out.status.success(),
                output: combined,
            }
        }
        Err(e) => OperationResult {
            operation: operation.to_string(),
            success: false,
            output: format!("Failed to execute command: {e}"),
        },
    }
}

fn get_installed_version(package_name: &str) -> Option<String> {
    let output = Command::new("npm")
        .args(["list", "-g", package_name, "--depth=0", "--json"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;
    let pkg_name = package_name.strip_prefix('@').map_or(package_name, |_| package_name);
    json["dependencies"][pkg_name]["version"]
        .as_str()
        .map(|s| s.to_string())
}

fn get_latest_version(package_name: &str) -> Option<String> {
    let output = Command::new("npm")
        .args(["view", package_name, "version"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
