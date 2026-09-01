files = [
    r"C:\Users\Falcon\Desktop\Hydro\frontend\src\index.css",
    r"C:\Users\Falcon\Desktop\Hydro\frontend\src\modules\hrms\index.css"
]

for file in files:
    print(f"File: {file}")
    with open(file, 'r') as f:
        lines = f.readlines()
        for idx, line in enumerate(lines):
            if 'overflow' in line:
                print(f"  Line {idx+1}: {line.strip()}")
                # Print 2 lines above and below
                for j in range(max(0, idx-2), min(len(lines), idx+3)):
                    print(f"    {j+1}: {lines[j].strip()}")
