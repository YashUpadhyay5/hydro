with open(r"C:\Users\Falcon\Desktop\Hydro\frontend\src\modules\hrms\services\api.js", 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if 'getAttendance' in line:
            print(f"Line {idx+1}: {line.strip()}")
