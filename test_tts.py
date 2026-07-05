import urllib.request
import urllib.error
import sys

def test_tts():
    url = "http://localhost:8001/api/tts?text=%E0%A4%86%E0%A4%97%E0%A5%87" # text=आगे
    print(f"Sending request to {url}...")
    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        )
        with urllib.request.urlopen(req) as response:
            status = response.status
            headers = response.info()
            content_type = headers.get('Content-Type')
            content = response.read()
            length = len(content)
            
            print(f"Response Status: {status}")
            print(f"Content-Type: {content_type}")
            print(f"Content Length: {length} bytes")
            
            if status == 200 and content_type == 'audio/mpeg' and length > 0:
                print("SUCCESS: Audio API is working and returning valid MPEG audio data!")
                return True
            else:
                print("FAILURE: Invalid response format or empty content.")
                return False
    except urllib.error.URLError as e:
        print(f"HTTP Connection/URL Error: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = test_tts()
    sys.exit(0 if success else 1)
