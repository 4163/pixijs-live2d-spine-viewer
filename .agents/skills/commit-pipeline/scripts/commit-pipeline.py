import os
import sys
sys.dont_write_bytecode = True
import subprocess
import shutil
import urllib.request

# Configuration for AI Committer
AI_CLI = "opencode"
AI_CMD = "run --auto"
AI_MODEL = "opencode/muse-spark-1.2-contributor-free"
AI_VARIANT = "xhigh"
INSTRUCTIONS_PATH = ".agents/skills/commit-pipeline/SKILL.md"

def get_config():
    config = {}
    current = None
    if not os.path.exists('.exclusion-config'):
        return config
        
    with open('.exclusion-config', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'): continue
            if line.startswith('[') and line.endswith(']'):
                current = line[1:-1]
                config[current] = []
            elif current:
                config[current].append(line)
    return config

def apply_submodule_sparse_checkout(config):
    for section, patterns in config.items():
        if section in ("netlify:/", "remote:/"):
            continue
            
        if os.path.isdir(os.path.join(section, '.git')):
            print(f"=== Applying sparse-checkout exclusions to {section} ===")
            subprocess.run(["git", "sparse-checkout", "init", "--no-cone"], cwd=section, check=True)
            subprocess.run(["git", "sparse-checkout", "set", "--stdin"], cwd=section, input='\n'.join(patterns).encode('utf-8'), check=True)

def download_remote_files(config):
    lines = []
    if "remote:/" in config:
        lines.extend(config["remote:/"])
    if os.path.exists('.filemodules'):
        with open('.filemodules', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    lines.append(line)
    if not lines:
        return
    print("=== Downloading remote files ===")
    for line in lines:
        if '=' in line:
            url, dest = [x.strip() for x in line.split('=', 1)]
            try:
                dest_dir = os.path.dirname(dest)
                if dest_dir:
                    os.makedirs(dest_dir, exist_ok=True)
                print(f"Downloading {url} -> {dest}")
                urllib.request.urlretrieve(url, dest)
            except Exception as e:
                print(f"Failed to download {url}: {e}")

def read_additional_info():
    """Prompt the user for additional commit/push info from the terminal.
    Read lines until an empty line or EOF; returns a single string."""
    print("=== Additional commit/push info (type your notes, end with an empty line) ===")
    lines = []
    try:
        while True:
            line = input("> ")
            if line.strip() == "":
                break
            lines.append(line)
    except EOFError:
        pass
    return "\n".join(lines).strip()


def do_push(manual=False, additional=""):
    print("=== Updating submodules ===")
    subprocess.run(["git", "submodule", "update", "--remote", "--init"], check=True)
    
    config = get_config()
    apply_submodule_sparse_checkout(config)
    download_remote_files(config)
    
    print("=== Staging all changes ===")
    subprocess.run(["git", "add", "-A"], check=True)
    
    if manual:
        print("=== Manual commit ===")
        msg = input("Commit message: ")
        subprocess.run(["git", "commit", "-m", msg], check=True)
        subprocess.run(["git", "push"], check=True)
        print("=== Done ===")
        return
    
    print("=== Running AI committer ===")
    
    cmd = [AI_CLI] + AI_CMD.split()
    if AI_MODEL:
        cmd.extend(["--model", AI_MODEL])
    if AI_VARIANT:
        cmd.extend(["--variant", AI_VARIANT])

    prompt = f"Follow the workflow in '{INSTRUCTIONS_PATH}'."
    if additional:
        # Prioritized user-provided context: takes precedence over anything the
        # AI infers from the diff/session data.
        prompt += (
            "\n\nUser-provided context about this commit/push (PRIORITIZED - "
            "treat this as the user's intent for what to commit and what the "
            "commit messages should emphasize):\n"
            f"{additional}"
        )

    cmd.append(prompt)
    subprocess.run(cmd, check=True)
    print("=== Done ===")

def do_netlify():
    config = get_config()
    apply_submodule_sparse_checkout(config)
    
    if "netlify:/" in config:
        print("=== Deleting root-excluded files for Netlify ===")
        for pattern in config["netlify:/"]:
            if os.path.isdir(pattern):
                shutil.rmtree(pattern, ignore_errors=True)
            elif os.path.exists(pattern):
                os.remove(pattern)
    print("=== Done ===")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python .agents/skills/commit-pipeline/scripts/commit-pipeline.py [push|netlify] [-x] [-a]")
        sys.exit(1)
        
    command = sys.argv[1]
    manual = "-x" in sys.argv[2:]
    additional = "-a" in sys.argv[2:]
    
    if command == "push":
        info = read_additional_info() if additional else ""
        do_push(manual=manual, additional=info)
    elif command == "netlify":
        do_netlify()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
