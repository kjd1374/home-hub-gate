import os
import sys
import json
import subprocess
import traceback
from openai import OpenAI

# Initialize client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    # Try to load from .env.local if not in environment
    try:
        with open('.env.local', 'r') as f:
            for line in f:
                if line.startswith('OPENAI_API_KEY='):
                    api_key = line.split('=', 1)[1].strip().strip('"')
                    break
    except:
        pass

if not api_key:
    print(json.dumps({"error": "OPENAI_API_KEY not found in environment or .env.local"}))
    sys.exit(1)

client = OpenAI(api_key=api_key)

def generate_code(prompt):
    """
    Generates Python code from a natural language prompt using GPT-4o.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert Python programmer. Write a complete Python script to solve the user's problem. Output ONLY the code within ```python``` blocks. Do not include explanations outside the code block. The code will be executed directly."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
        )
        content = response.choices[0].message.content
        
        # Extract code block
        if "```python" in content:
            code = content.split("```python")[1].split("```")[0].strip()
        elif "```" in content:
            code = content.split("```")[1].split("```")[0].strip()
        else:
            code = content.strip()
            
        return code
    except Exception as e:
        return None, str(e)

def execute_code(code):
    """
    Executes the generated Python code and captures output.
    Warning: This executes code directly on the host machine.
    """
    try:
        # Create a temporary file
        with open("temp_codex_script.py", "w") as f:
            f.write(code)
            
        # Execute
        result = subprocess.run(
            ["python3", "temp_codex_script.py"],
            capture_output=True,
            text=True,
            timeout=30  # 30 seconds timeout
        )
        
        # Cleanup
        if os.path.exists("temp_codex_script.py"):
            os.remove("temp_codex_script.py")
            
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "code": code
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Execution timed out (30s)", "code": code}
    except Exception as e:
        return {"success": False, "error": str(e), "code": code}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 codex_runner.py <prompt>"}))
        sys.exit(1)
        
    prompt = sys.argv[1]
    
    # Geneate
    code = generate_code(prompt)
    if isinstance(code, tuple): # Error
        print(json.dumps({"error": f"Generation failed: {code[1]}"}))
        sys.exit(1)
        
    # Execute
    result = execute_code(code)
    
    # Return JSON result
    print(json.dumps(result))
