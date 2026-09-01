with open(r"C:\Users\Falcon\Desktop\Hydro\frontend\src\modules\hrms\index.css", 'r') as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if '.view' in line or 'attendance-view' in line:
            print(f"Line {idx+1}: {line.strip()}")
            for j in range(max(0, idx-2), min(len(lines), idx+6)):
                print(f"  {j+1}: {lines[j].strip()}")
