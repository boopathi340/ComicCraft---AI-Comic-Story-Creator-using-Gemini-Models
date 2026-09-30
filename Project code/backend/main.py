import os
import json
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Please check your .env file."
    )


# ============================================================
# GEMINI CLIENT
# ============================================================

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="ComicCraft API",
    description="AI Comic Story Creator using Gemini",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class StoryRequest(BaseModel):
    prompt: str = ""
    genre: str = "Comedy"
    panel_count: int = Field(
        default=6,
        ge=1,
        le=12
    )

    story_idea: str = ""
    number_of_panels: int | None = None


class PanelImageRequest(BaseModel):
    panel_number: int = 1
    panel_title: str = ""
    scene: str = ""
    dialogue: str = ""
    characters: list = []
    genre: str = "Comedy"


# ============================================================
# HELPERS
# ============================================================

def get_story_prompt(request: StoryRequest):

    prompt = (
        request.prompt.strip()
        if request.prompt
        else request.story_idea.strip()
    )

    if not prompt:
        raise HTTPException(
            status_code=400,
            detail="Please provide a story idea."
        )

    return prompt


def get_panel_count(request: StoryRequest):

    if request.number_of_panels is not None:
        return request.number_of_panels

    return request.panel_count


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "success": True,
        "message": "ComicCraft API is running"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "success": True,
        "status": "healthy"
    }


# ============================================================
# TEST GEMINI
# ============================================================

@app.get("/test-gemini")
def test_gemini():

    models = [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
    ]

    last_error = None

    for model_name in models:

        try:

            response = client.models.generate_content(
                model=model_name,
                contents=(
                    "Reply with exactly: "
                    "Gemini connection successful"
                )
            )

            return {
                "success": True,
                "model": model_name,
                "response": response.text
            }

        except Exception as e:

            last_error = str(e)

    raise HTTPException(
        status_code=500,
        detail={
            "message": "Gemini connection failed.",
            "error": last_error
        }
    )


# ============================================================
# GENERATE STORY
# ============================================================

@app.post("/generate-story")
def generate_story(request: StoryRequest):

    story_prompt = get_story_prompt(request)
    panel_count = get_panel_count(request)

    genre = (
        request.genre.strip()
        if request.genre
        else "Comedy"
    )

    generation_prompt = f"""
You are an expert comic book writer.

Create a complete comic story based on the user's idea.

USER STORY IDEA:
{story_prompt}

GENRE:
{genre}

NUMBER OF PANELS:
{panel_count}

Return ONLY valid JSON.

Use exactly this structure:

{{
  "title": "Comic story title",
  "genre": "{genre}",
  "summary": "Short story summary",
  "characters": [
    {{
      "name": "Character name",
      "role": "Character role",
      "personality": "Character personality"
    }}
  ],
  "panels": [
    {{
      "panel_number": 1,
      "title": "Panel title",
      "scene": "Detailed visual description of the scene",
      "dialogue": "Character dialogue"
    }}
  ]
}}

IMPORTANT:
- Create exactly {panel_count} panels.
- panel_number starts at 1.
- Every panel needs title, scene and dialogue.
- Characters must remain visually consistent.
- Make every scene suitable for AI image generation.
- Keep dialogue concise.
- Do not use markdown.
- Do not use code fences.
"""

    models = [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
    ]

    last_error = None

    for attempt in range(3):

        for model_name in models:

            try:

                response = client.models.generate_content(
                    model=model_name,
                    contents=generation_prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )

                raw_text = response.text.strip()

                if raw_text.startswith("```"):

                    raw_text = (
                        raw_text
                        .replace("```json", "")
                        .replace("```", "")
                        .strip()
                    )

                story_data = json.loads(
                    raw_text
                )

                if not story_data.get("title"):
                    story_data["title"] = (
                        "Untitled Comic"
                    )

                story_data["genre"] = (
                    story_data.get("genre")
                    or genre
                )

                story_data["summary"] = (
                    story_data.get("summary")
                    or "An AI-generated comic story."
                )

                if not isinstance(
                    story_data.get("characters"),
                    list
                ):
                    story_data["characters"] = []

                if not isinstance(
                    story_data.get("panels"),
                    list
                ):
                    story_data["panels"] = []

                normalized_panels = []

                for index, panel in enumerate(
                    story_data["panels"][
                        :panel_count
                    ]
                ):

                    if not isinstance(
                        panel,
                        dict
                    ):
                        continue

                    normalized_panels.append(
                        {
                            "panel_number": index + 1,
                            "title": panel.get(
                                "title",
                                f"Panel {index + 1}"
                            ),
                            "scene": panel.get(
                                "scene",
                                ""
                            ),
                            "dialogue": panel.get(
                                "dialogue",
                                ""
                            )
                        }
                    )

                story_data["panels"] = (
                    normalized_panels
                )

                return {
                    "success": True,
                    "story": story_data
                }

            except Exception as e:

                last_error = str(e)

                print(
                    f"Story generation failed "
                    f"with {model_name}: "
                    f"{last_error}"
                )

        if attempt < 2:
            time.sleep(3)

    raise HTTPException(
        status_code=503,
        detail={
            "message": (
                "Gemini story generation failed."
            ),
            "error": last_error
        }
    )


# ============================================================
# GENERATE PANEL IMAGE
# ============================================================

@app.post("/generate-panel-image")
def generate_panel_image(
    request: PanelImageRequest
):

    # --------------------------------------------------------
    # CHARACTER INFORMATION
    # --------------------------------------------------------

    character_text = ""

    for character in request.characters:

        if isinstance(
            character,
            dict
        ):

            name = character.get(
                "name",
                "Unknown"
            )

            role = character.get(
                "role",
                ""
            )

            personality = character.get(
                "personality",
                ""
            )

            character_text += (
                f"- {name}: "
                f"{role}. "
                f"{personality}\n"
            )

    # --------------------------------------------------------
    # IMAGE PROMPT
    # --------------------------------------------------------

    image_prompt = f"""
Create a professional cinematic comic-book illustration.

GENRE:
{request.genre}

PANEL NUMBER:
{request.panel_number}

PANEL TITLE:
{request.panel_title}

SCENE:
{request.scene}

DIALOGUE CONTEXT:
{request.dialogue}

CHARACTERS:
{character_text}

VISUAL STYLE:

- Professional comic book artwork
- Cinematic composition
- Detailed characters
- Expressive faces
- Dynamic poses
- Rich colors
- Clean line art
- High quality illustration
- Strong cinematic lighting
- Detailed college environment
- Consistent character appearance
- Landscape 16:9 composition

IMPORTANT:

- Create ONE comic panel.
- Do not create multiple panels.
- Do not create a poster.
- Do not add captions.
- Do not add speech bubbles.
- Do not add readable text.
- Do not add watermarks manually.
"""


    # --------------------------------------------------------
    # IMAGE GENERATION
    # --------------------------------------------------------

    for attempt in range(2):

        try:

            interaction = client.interactions.create(
                model="gemini-3.1-flash-image",
                input=image_prompt,

                # IMPORTANT:
                # Do NOT specify image/png here.
                # Gemini currently accepts JPEG for
                # this response format.

                response_format={
                    "type": "image",
                    "mime_type": "image/jpeg",
                    "aspect_ratio": "16:9",
                    "image_size": "1K"
                }
            )

            image_output = (
                interaction.output_image
            )

            if not image_output:

                raise Exception(
                    "Gemini did not return an image."
                )

            image_data = (
                image_output.data
            )

            if not image_data:

                raise Exception(
                    "Gemini returned empty image data."
                )

            return {
                "success": True,
                "panel_number": (
                    request.panel_number
                ),
                "mime_type": "image/jpeg",
                "image": image_data
            }

        except Exception as e:

            print(
                f"Image generation attempt "
                f"{attempt + 1} failed:"
            )

            print(str(e))

            if attempt == 0:
                time.sleep(5)

            else:

                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": (
                            "Panel image "
                            "generation failed."
                        ),
                        "error": str(e)
                    }
                )