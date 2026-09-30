import { useState } from "react";
import "./App.css";

const BACKEND_URL = "http://localhost:8000";

function App() {
  const [page, setPage] = useState("home");

  const [storyPrompt, setStoryPrompt] = useState("");
  const [genre, setGenre] = useState("Comedy");
  const [panelCount, setPanelCount] = useState(6);

  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const [story, setStory] = useState(null);
  const [panelImages, setPanelImages] = useState({});

  const [error, setError] = useState("");

  // ==========================================================
  // ERROR MESSAGE HELPER
  // ==========================================================

  const getErrorMessage = (data) => {
    if (!data) {
      return "Unknown server error.";
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (data.detail) {
      try {
        return JSON.stringify(
          data.detail,
          null,
          2
        );
      } catch {
        return String(data.detail);
      }
    }

    if (data.message) {
      return data.message;
    }

    return "Request failed.";
  };

  // ==========================================================
  // GENERATE STORY
  // ==========================================================

  const generateStory = async () => {
    if (!storyPrompt.trim()) {
      setError("Please enter a story idea.");
      return;
    }

    setError("");
    setLoading(true);
    setStory(null);
    setPanelImages({});
    setPage("generating");

    try {
      const requestBody = {
        prompt: storyPrompt.trim(),
        genre: genre,
        panel_count: Number(panelCount),
      };

      console.log(
        "Sending story request:",
        requestBody
      );

      const response = await fetch(
        `${BACKEND_URL}/generate-story`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      console.log(
        "Story API response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      if (!data.success) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      if (!data.story) {
        throw new Error(
          "Backend returned no story."
        );
      }

      setStory(data.story);
      setPage("result");

      // Start image generation
      generatePanelImages(data.story);

    } catch (err) {

      console.error(
        "Story generation error:",
        err
      );

      setError(
        err.message ||
        "Something went wrong."
      );

      setPage("create");

    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // GENERATE PANEL IMAGES
  // ==========================================================

  const generatePanelImages = async (
    storyData
  ) => {

    if (
      !storyData ||
      !Array.isArray(storyData.panels) ||
      storyData.panels.length === 0
    ) {
      console.warn(
        "No panels found."
      );

      return;
    }

    setImageLoading(true);

    const generatedImages = {};

    try {

      for (
        let i = 0;
        i < storyData.panels.length;
        i++
      ) {

        const panel =
          storyData.panels[i];

        const panelNumber =
          i + 1;

        console.log(
          `Generating image ${panelNumber}/${storyData.panels.length}`
        );

        try {

          const requestBody = {
            panel_number:
              panelNumber,

            panel_title:
              panel.title ||
              `Panel ${panelNumber}`,

            scene:
              panel.scene ||
              "",

            dialogue:
              panel.dialogue ||
              "",

            characters:
              Array.isArray(
                storyData.characters
              )
                ? storyData.characters
                : [],

            genre:
              storyData.genre ||
              genre,
          };

          console.log(
            "Image request:",
            requestBody
          );

          const response =
            await fetch(
              `${BACKEND_URL}/generate-panel-image`,
              {
                method: "POST",
                headers: {
                  Accept:
                    "application/json",
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify(
                    requestBody
                  ),
              }
            );

          const data =
            await response.json();

          console.log(
            `Image response ${panelNumber}:`,
            data
          );

          if (!response.ok) {

            console.error(
              `Panel ${panelNumber} failed:`,
              getErrorMessage(data)
            );

            continue;
          }

          if (
            data.success &&
            data.image
          ) {

            generatedImages[
              panelNumber
            ] =
              `data:${
                data.mime_type ||
                "image/png"
              };base64,${
                data.image
              }`;

            setPanelImages({
              ...generatedImages,
            });
          }

        } catch (panelError) {

          console.error(
            `Panel ${panelNumber} image error:`,
            panelError
          );
        }
      }

    } finally {

      setImageLoading(false);
    }
  };

  // ==========================================================
  // NEW COMIC
  // ==========================================================

  const createNewStory = () => {

    setStory(null);
    setPanelImages({});
    setStoryPrompt("");
    setError("");
    setPage("create");
  };

  // ==========================================================
  // HOME
  // ==========================================================

  const renderHome = () => (
    <div className="page home-page">

      <div className="hero">

        <div className="hero-badge">
          ✨ POWERED BY GEMINI AI
        </div>

        <h1>
          Create Your Own
          <span> Comic Story</span>
        </h1>

        <p>
          Turn your imagination into a complete
          comic story with AI-generated
          characters, scenes and comic panels.
        </p>

        <button
          className="primary-btn"
          onClick={() =>
            setPage("create")
          }
        >
          🚀 Create Comic
        </button>

      </div>

      <div className="feature-grid">

        <div className="feature-card">
          <div className="feature-icon">
            ✍️
          </div>

          <h3>
            AI Story Creation
          </h3>

          <p>
            Describe your idea and Gemini
            creates a complete comic story.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            🧑‍🎨
          </div>

          <h3>
            Character Creation
          </h3>

          <p>
            Generate unique characters with
            personalities and roles.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            🎨
          </div>

          <h3>
            AI Comic Panels
          </h3>

          <p>
            Convert every scene into an
            AI-generated comic image.
          </p>
        </div>

      </div>
    </div>
  );

  // ==========================================================
  // CREATE
  // ==========================================================

  const renderCreate = () => (
    <div className="page create-page">

      <div className="section-header">

        <div>
          <span className="small-label">
            COMICCRAFT STUDIO
          </span>

          <h2>
            Create Your Comic
          </h2>

          <p>
            Give Gemini your story idea and
            let AI build the comic.
          </p>
        </div>

      </div>

      {error && (
        <div className="error-box">
          ⚠️
          <pre
            style={{
              whiteSpace: "pre-wrap",
              margin: 0,
              display: "inline",
              marginLeft: "8px",
            }}
          >
            {error}
          </pre>
        </div>
      )}

      <div className="create-card">

        <label>
          Story Idea
        </label>

        <textarea
          value={storyPrompt}
          onChange={(e) =>
            setStoryPrompt(
              e.target.value
            )
          }
          placeholder="Example: A nervous college freshman accidentally becomes the leader of a secret college adventure..."
          rows={7}
        />

        <div className="form-grid">

          <div>

            <label>
              Genre
            </label>

            <select
              value={genre}
              onChange={(e) =>
                setGenre(
                  e.target.value
                )
              }
            >
              <option>
                Comedy
              </option>

              <option>
                Action
              </option>

              <option>
                Adventure
              </option>

              <option>
                Fantasy
              </option>

              <option>
                Science Fiction
              </option>

              <option>
                Horror
              </option>

              <option>
                Romance
              </option>

              <option>
                Mystery
              </option>
            </select>

          </div>

          <div>

            <label>
              Panels
            </label>

            <select
              value={panelCount}
              onChange={(e) =>
                setPanelCount(
                  Number(
                    e.target.value
                  )
                )
              }
            >
              <option value={4}>
                4 Panels
              </option>

              <option value={6}>
                6 Panels
              </option>

              <option value={8}>
                8 Panels
              </option>
            </select>

          </div>

        </div>

        <button
          className="primary-btn full-btn"
          onClick={
            generateStory
          }
          disabled={loading}
        >
          {loading
            ? "🤖 Creating Story..."
            : "✨ Generate Comic"}
        </button>

      </div>
    </div>
  );

  // ==========================================================
  // GENERATING
  // ==========================================================

  const renderGenerating = () => (
    <div className="page loading-page">

      <div className="loading-card">

        <div className="loader">
          ✨
        </div>

        <h2>
          Creating Your Comic...
        </h2>

        <p>
          Gemini is writing your story,
          creating characters and preparing
          your comic panels.
        </p>

        <div className="loading-bar">
          <div className="loading-progress"></div>
        </div>

      </div>

    </div>
  );

  // ==========================================================
  // RESULT
  // ==========================================================

  const renderResult = () => {

    if (!story) {
      return null;
    }

    return (
      <div className="page result-page">

        <div className="result-header">

          <div>

            <span className="small-label">
              YOUR AI COMIC
            </span>

            <h2>
              {story.title ||
                "Your Comic Story"}
            </h2>

            <div className="story-meta">

              <span>
                🎭{" "}
                {story.genre ||
                  genre}
              </span>

              <span>
                📖{" "}
                {story.panels?.length ||
                  panelCount}{" "}
                Panels
              </span>

            </div>

          </div>

          <button
            className="secondary-btn"
            onClick={
              createNewStory
            }
          >
            + New Comic
          </button>

        </div>

        <div className="summary-card">

          <h3>
            📚 Story Summary
          </h3>

          <p>
            {story.summary ||
              "AI-generated comic story."}
          </p>

        </div>

        {Array.isArray(
          story.characters
        ) &&
          story.characters.length >
            0 && (

          <section className="result-section">

            <h3>
              👥 Characters
            </h3>

            <div className="character-grid">

              {story.characters.map(
                (
                  character,
                  index
                ) => (

                  <div
                    className="character-card"
                    key={index}
                  >

                    <div className="character-avatar">
                      {character.name
                        ?.charAt(0)
                        ?.toUpperCase() ||
                        "?"}
                    </div>

                    <div>

                      <h4>
                        {character.name ||
                          `Character ${
                            index + 1
                          }`}
                      </h4>

                      <p>
                        {character.role ||
                          ""}
                      </p>

                      <small>
                        {character.personality ||
                          ""}
                      </small>

                    </div>

                  </div>

                )
              )}

            </div>

          </section>

        )}

        <section className="result-section">

          <div className="storyboard-header">

            <div>

              <h3>
                🎨 Comic Storyboard
              </h3>

              <p>
                AI-generated comic panels
              </p>

            </div>

            {imageLoading && (
              <div className="image-status">
                🎨 Generating images...
              </div>
            )}

          </div>

          <div className="panel-grid">

            {Array.isArray(
              story.panels
            ) &&
              story.panels.map(
                (
                  panel,
                  index
                ) => {

                  const panelNumber =
                    index + 1;

                  const image =
                    panelImages[
                      panelNumber
                    ];

                  return (
                    <div
                      className="comic-panel"
                      key={index}
                    >

                      <div className="panel-number">
                        PANEL{" "}
                        {panelNumber}
                      </div>

                      {image ? (

                        <img
                          src={image}
                          alt={`Comic panel ${panelNumber}`}
                          className="comic-image"
                        />

                      ) : (

                        <div className="image-placeholder">

                          <div className="placeholder-icon">
                            {imageLoading
                              ? "🎨"
                              : "🎬"}
                          </div>

                          <span>
                            {imageLoading
                              ? "Generating AI image..."
                              : "AI image"}
                          </span>

                        </div>

                      )}

                      <div className="panel-info">

                        <h4>
                          {panel.title ||
                            `Panel ${
                              panelNumber
                            }`}
                        </h4>

                        <p>
                          {panel.scene ||
                            ""}
                        </p>

                        {panel.dialogue && (
                          <div className="dialogue">
                            💬{" "}
                            {
                              panel.dialogue
                            }
                          </div>
                        )}

                      </div>

                    </div>
                  );
                }
              )}

          </div>

        </section>

      </div>
    );
  };

  // ==========================================================
  // APP
  // ==========================================================

  return (
    <div className="app">

      <nav className="navbar">

        <div
          className="logo"
          onClick={() =>
            setPage("home")
          }
        >
          <span className="logo-icon">
            ⚡
          </span>

          ComicCraft
        </div>

        <div className="nav-links">

          <button
            className={
              page === "home"
                ? "active"
                : ""
            }
            onClick={() =>
              setPage("home")
            }
          >
            Home
          </button>

          <button
            className={
              page === "create"
                ? "active"
                : ""
            }
            onClick={() =>
              setPage("create")
            }
          >
            Create
          </button>

        </div>

      </nav>

      {page === "home" &&
        renderHome()}

      {page === "create" &&
        renderCreate()}

      {page === "generating" &&
        renderGenerating()}

      {page === "result" &&
        renderResult()}

    </div>
  );
}

export default App;