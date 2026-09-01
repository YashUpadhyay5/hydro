with open(r"C:\Users\Falcon\Desktop\Hydro\frontend\src\modules\hrms\index.css", 'r', encoding='utf-8') as f:
    content = f.read()
    for idx, line in enumerate(content.split('\n')):
        if '#employees' in line:
            print(f"Line {idx+1}: {line.strip()}")
