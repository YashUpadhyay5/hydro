import os

target_dir = r"C:\Users\Falcon\Desktop\Hydro\frontend\src"
for root, dirs, files in os.walk(target_dir):
    for file in files:
        if file.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if 'getLatestAllFootprints' in content:
                    print(f"File: {filepath}")
                    for idx, line in enumerate(content.split('\n')):
                        if 'getLatestAllFootprints' in line or 'latestAll' in line or '.userId' in line or '.user_id' in line:
                            print(f"  Line {idx+1}: {line.strip()}")
