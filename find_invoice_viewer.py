import os

target_dir = r"C:\Users\Falcon\Desktop\Hydro\frontend\src\modules\invoice"
for root, dirs, files in os.walk(target_dir):
    for file in files:
        if file.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if any(k in content for k in ['iframe', 'pdf', '.pdf', 'embed', 'InvoiceViewer', 'FileViewer']):
                    print(f"File: {filepath}")
                    for idx, line in enumerate(content.split('\n')):
                        if any(k in line for k in ['iframe', 'pdf', 'embed', 'src']):
                            print(f"  Line {idx+1}: {line.strip()}")
