# Requirements:
#   - python     (python.org)
#   - make       (MSYS2: choco install msys2 → pacman -S make)
#   - git        (git-scm.com)
#   - opencode   (opencode.ai)
#
# Targets:
#   make push     - update submodules, download remote files, stage all changes,
#                   then AI commit and push via opencode
#   make push-x   - same as above but skip AI committer; opens git commit editor
#                   for a manual message, then pushes
#   make push-a   - same as make push, but first prompts for additional
#                   commit/push info typed in the terminal, which is passed to
#                   the AI committer as prioritized context
#
# Notes:
#   MSYS2's make sets HOME to its own home (C:\tools\msys64\home\<user>\).
#   Git reads global config from that HOME, not from Windows home.
#   Without these configured there, you'll get "dubious ownership" and
#   "Author identity unknown" (falls back to user@hostname.(none)):
#     git config --global --add safe.directory "E:/Projects/PixiJS Live2D Spine (Springfield)"
#     git config --global user.name "4163"
#     git config --global user.email "x4163x@gmail.com"
#   (Run with HOME=C:\tools\msys64\home\x4163 to configure for MSYS2.)

.PHONY: push push-x push-a

push:
	python -I .agents/skills/commit-pipeline/scripts/commit-pipeline.py push

push-x:
	python -I .agents/skills/commit-pipeline/scripts/commit-pipeline.py push -x

push-a:
	python -I .agents/skills/commit-pipeline/scripts/commit-pipeline.py push -a
