import re

def patch_index():
    with open('indexlol.html', 'r', encoding='utf-8') as f:
        lol_html = f.read()
        
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Extract PocketBase script tag
    pb_script = '<script src="https://cdn.jsdelivr.net/npm/pocketbase@0.22.0/dist/pocketbase.umd.js"></script>'
    
    # Extract PocketBase DB logic from indexlol.html
    # It starts at "const pb = new PocketBase" and ends after save(key) function before defaultConfig
    match = re.search(r'(const pb = new PocketBase.*?)(?=function defaultConfig\(\)\{)', lol_html, re.DOTALL)
    if not match:
        print("Could not find pb logic in indexlol.html")
        return
    pb_logic = match.group(1)
    
    # Now replace the DB logic in index.html
    # It starts at "async function loadDB" and ends after save(key) function before defaultConfig
    target_match = re.search(r'(async function loadDB\(\).*?)(?=function defaultConfig\(\)\{)', html, re.DOTALL)
    if not target_match:
        print("Could not find target logic in index.html")
        return
        
    new_html = html[:target_match.start()] + pb_logic + html[target_match.end():]
    
    # Insert pb_script before </head> if not exists
    if pb_script not in new_html:
        new_html = new_html.replace('</head>', pb_script + '\n</head>')
        
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
        
    print("Successfully patched index.html with PocketBase logic.")

patch_index()
