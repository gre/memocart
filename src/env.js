export default {
  highscoresAPI:
    process.env.NODE_ENV === "development"
      ? "http://localhost:9832"
      : "https://memocart.herokuapp.com"
};
