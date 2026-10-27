#!/usr/bin/env python3
"""VLM-describe images: z-ai vision wrapper that strips the CLI banner.

Usage: python3 vlm.py IMAGE "prompt"
"""
import json
import subprocess
import sys

img, prompt = sys.argv[1], sys.argv[2]
out = subprocess.run(
    ["z-ai", "vision", "--image", img, "--prompt", prompt],
    capture_output=True, text=True, timeout=180,
).stdout
# find the first '{' — the banner lines precede the JSON
i = out.find("{")
if i < 0:
    print(out)
    sys.exit(1)
data = json.loads(out[i:])
print(data["choices"][0]["message"]["content"])
