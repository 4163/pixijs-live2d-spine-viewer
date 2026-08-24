# Requirements:
#   - python     (python.org)
#   - make       (MSYS2: choco install msys2 → pacman -S make)
#   - git        (git-scm.com)
#   - opencode   (opencode.ai)
#
# Targets:
#   make push     - update submodules, download remote files, stage all changes,
#                   then AI commit and push via opencode
#   make push-x   - same as above but skip AI committer; prompts for
#                   commit message via terminal, then commits and pushes
#   make push-a   - same as make push, but first prompts for additional
#                   commit/push info typed in the terminal, which is passed to
#                   the AI committer as prioritized context
#
# Notes:
#   MSYS2's make sets HOME to its own home (C:\tools\msys64\home\<user>\).
#   Git reads global config from that HOME, not from Windows home.
#   Without these configured there, you'll get "dubious ownership" and
#   "Author identity unknown" (falls back to user@hostname.(none)):
#     git config --global --add safe.directory <path/to/repo>
#     git config --global user.name "Your Name"
#     git config --global user.email "you@example.com"
#   (Run with HOME=C:\tools\msys64\home\<user> to configure for MSYS2.)

.PHONY: push push-x push-a

push:
	python -I .agents/skills/commit-pipeline/scripts/commit-pipeline.py push

push-x:
	python -I .agents/skills/commit-pipeline/scripts/commit-pipeline.py push -x

push-a:
	python -I .agents/skills/commit-pipeline/scripts/commit-pipeline.py push -a
