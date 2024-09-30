import { auth } from "../../lib/Firebase";
import "./Detail.css";
const Detail = () => {
  return (
    <div className="detail">
      <div className="user">
        <img src="./avatar.png" alt="avatar png" />
        <h2>Anil Kumar</h2>
        <p>Lorem ipsum dolor sit amet</p>
      </div>
      <div className="info">
        <div className="option">
          <div className="title">
            <span> Chat settings</span>
            <img src="./arrowUp.png" alt="arrow logo" />
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span> Privacy & help</span>
            <img src="./arrowUp.png" alt="arrow logo" />
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span> Shared Photos</span>
            <img src="./arrowDown.png" alt="arrow logo" />
          </div>
          <div className="photos">
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span> Shared Files</span>
            <img src="./arrowUp.png" alt="arrow logo" />
          </div>
        </div>
        <button>Block User</button>
        <button className="logout" onClick={()=> auth.signOut()}>Logout</button>
      </div>
    </div>
  );
};

export default Detail;
