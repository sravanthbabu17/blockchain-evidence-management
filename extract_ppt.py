import zipfile
import xml.etree.ElementTree as ET
import os

def extract_text_from_pptx(path):
    if not os.path.exists(path):
        return f"File {path} not found."
    
    texts = []
    try:
        with zipfile.ZipFile(path, 'r') as zip_ref:
            # List all slide files
            slide_files = [f for f in zip_ref.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml')]
            slide_files.sort(key=lambda x: int(x.replace('ppt/slides/slide', '').replace('.xml', '')))
            
            for slide_file in slide_files:
                texts.append(f"--- {slide_file} ---")
                with zip_ref.open(slide_file) as f:
                    tree = ET.parse(f)
                    root = tree.getroot()
                    # Namespaces
                    ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                          'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
                    
                    # Find all text elements
                    for t in root.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}t'):
                        if t.text:
                            texts.append(t.text)
    except Exception as e:
        return f"Error: {str(e)}"
    
    return "\n".join(texts)

if __name__ == "__main__":
    pptx_path = "Final_review.pptx"
    print(extract_text_from_pptx(pptx_path))
