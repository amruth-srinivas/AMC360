import re

filepath = r"D:\Amruth\AAMMCC\frontend\src\pages\screens.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    "bg-slate-50": "bg-muted/30",
    "bg-slate-100": "bg-muted",
    "border-slate-200": "border-border",
    "text-slate-900": "text-foreground",
    "text-slate-800": "text-foreground/90",
    "text-slate-700": "text-foreground/80",
    "text-slate-600": "text-muted-foreground",
    "text-slate-500": "text-muted-foreground/80",
    "text-slate-400": "text-muted-foreground/60",
    "bg-white": "bg-transparent",
    "shadow-sm": "shadow-glass-sm",
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
