import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = open('index.html', encoding='utf-8').read()
original_len = len(c)
changes = []

# 1. CSS
old_css = """.main{ flex:1; min-width:0; display:flex; flex-direction:column; }
.topbar{
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 28px; border-bottom:1px solid var(--line);
  background:var(--paper-raised);
  position:sticky; top:0; z-index:5;
}
.topbar h1{ font-size:20px; margin:0; font-weight:600; }
.topbar .rate-pill{
  display:flex; align-items:center; gap:8px;
  background:var(--gold-tint); color:var(--gold-deep);
  padding:6px 12px; border-radius:20px; font-size:12.5px; font-weight:600;
}
.content{ padding:24px 28px 60px 28px; max-width:1180px; }"""

new_css = """.main{ flex:1; min-width:0; display:flex; flex-direction:column; }
.menu-btn{ display:none; background:transparent; border:none; font-size:22px; cursor:pointer; color:var(--ink); padding:4px 10px 4px 0; line-height:1; }
.sidebar-backdrop{ display:none; }
.topbar{
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 28px; border-bottom:1px solid var(--line);
  background:var(--paper-raised);
  position:sticky; top:0; z-index:5;
}
.topbar h1{ font-size:20px; margin:0; font-weight:600; }
.topbar .rate-pill{
  display:flex; align-items:center; gap:8px;
  background:var(--gold-tint); color:var(--gold-deep);
  padding:6px 12px; border-radius:20px; font-size:12.5px; font-weight:600;
}
.content{ padding:24px 28px 60px 28px; max-width:1180px; }

@media(max-width:860px){
  .menu-btn{ display:inline-block; }
  .sidebar{
    position:fixed; left:-260px; top:0; height:100vh; width:230px;
    z-index:60; transition:left .2s ease; box-shadow:0 0 40px rgba(0,0,0,.35);
  }
  .sidebar.open{ left:0; }
  .sidebar-backdrop.open{
    display:block; position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:55;
  }
  .content{ padding:14px 14px 60px 14px; }
  .topbar{ padding:10px 14px; flex-wrap:wrap; gap:8px; }
  .topbar h1{ font-size:16px; display:flex; align-items:center; }
  .topbar .rate-pill{ font-size:10.5px; padding:5px 9px; gap:5px; }
  .grid-2,.grid-3,.grid-4{ grid-template-columns:1fr; }
  .overlay{ padding:0; align-items:stretch; }
  .modal{ max-width:100%; border-radius:0; min-height:100vh; }
  .modal.wide{ max-width:100%; }
  .ticket{ width:100%; max-width:300px; }
  .card-pad{ padding:14px; }
}"""

if ".sidebar-backdrop.open{" in c:
    changes.append("- CSS: ya aplicado, se omite")
elif old_css in c:
    c = c.replace(old_css, new_css, 1)
    changes.append("✓ CSS media queries")
else:
    changes.append("✗ CSS NO ENCONTRADO")


# 2. render() sidebar
old_sidebar = '<div class="sidebar no-print">'
new_sidebar = '<div class="sidebar-backdrop no-print" onclick="toggleSidebar(false)"></div>\n    <div class="sidebar no-print">'

if "sidebar-backdrop" in c and ".sidebar-backdrop" not in c[c.find("sidebar-backdrop"):c.find("sidebar-backdrop")+20]: # Ensure it's the class name not just CSS
    pass # Wait, let's just check the exact new string
if new_sidebar in c:
    changes.append("- HTML sidebar: ya aplicado, se omite")
elif old_sidebar in c:
    c = c.replace(old_sidebar, new_sidebar, 1)
    changes.append("✓ HTML sidebar-backdrop")
else:
    changes.append("✗ HTML sidebar NO ENCONTRADO")


# 3. render() topbar h1
old_h1 = "<h1>${LABELS[VIEW]||''}</h1>"
new_h1 = '<h1><button class="menu-btn" onclick="toggleSidebar()" aria-label="Menú">☰</button>${LABELS[VIEW]||\'\'}</h1>'

if new_h1 in c:
    changes.append("- HTML h1: ya aplicado, se omite")
elif old_h1 in c:
    c = c.replace(old_h1, new_h1, 1)
    changes.append("✓ HTML h1 menu-btn")
else:
    changes.append("✗ HTML h1 NO ENCONTRADO")


# 4. toggleSidebar function
new_func = """function toggleSidebar(force){
  const sb = document.querySelector('.sidebar');
  const bd = document.querySelector('.sidebar-backdrop');
  const open = typeof force === 'boolean' ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  bd.classList.toggle('open', open);
}"""
old_func_loc = "function navigate(view){ VIEW = view; render(); window.scrollTo(0,0); }"

if "function toggleSidebar" in c:
    changes.append("- JS toggleSidebar: ya aplicado, se omite")
elif old_func_loc in c:
    c = c.replace(old_func_loc, old_func_loc + "\n\n" + new_func, 1)
    changes.append("✓ JS toggleSidebar")
else:
    changes.append("✗ JS toggleSidebar location NO ENCONTRADA")


if any(ch.startswith("✓") for ch in changes):
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Archivo guardado ({len(c):,} bytes, era {original_len:,})")
else:
    print("No se hicieron cambios.")
for ch in changes:
    print(ch)
