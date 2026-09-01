with open(r"C:\Users\Falcon\Desktop\Hydro\frontend\src\modules\hrms\components\views\AttendanceView.jsx", 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if 'setLatestFootprints' in line:
            print(f"Line {idx+1}: {line.strip()}")
