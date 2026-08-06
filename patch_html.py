import re
import sys

def patch_html():
    # Read the base64 content
    with open('processed_logo.png.b64', 'r') as f:
        b64_content = f.read()
        
    # Read the HTML file
    with open('mantente.html', 'r', encoding='utf-8') as f:
        html = f.read()
        
    # Replace LOGO_ICON
    # Need to find const LOGO_ICON = "..."; and replace it
    pattern = r'(const LOGO_ICON = ")[^"]+(")'
    new_html = re.sub(pattern, r'\g<1>' + b64_content + r'\g<2>', html, count=1)
    
    # Add favicon
    # Find <title>...
    if '<link rel="icon"' not in new_html:
        title_pattern = r'(<title>.*?</title>)'
        favicon_tag = f'\n<link rel="icon" type="image/png" href="{b64_content}">'
        new_html = re.sub(title_pattern, r'\g<1>' + favicon_tag, new_html, count=1)
        
    # Write the modified HTML back
    with open('mantente.html', 'w', encoding='utf-8') as f:
        f.write(new_html)

patch_html()
print("HTML patched successfully!")
