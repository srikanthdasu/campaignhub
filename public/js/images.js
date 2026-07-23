const user = JSON.parse(localStorage.getItem("user"));

loadImages();

async function saveImage(){

    const prompt = document.getElementById("prompt").value;

    const image_url = document.getElementById("imageUrl").value;

    if(!prompt || !image_url){

        alert("Enter prompt and image URL");

        return;

    }

    await fetch("/images",{

        method:"POST",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify({

            user_id:user.id,

            prompt,

            image_url

        })

    });

    document.getElementById("prompt").value="";

    document.getElementById("imageUrl").value="";

    loadImages();

}

async function loadImages(){

    const res = await fetch("/images");

    const data = await res.json();

    gallery.innerHTML="";

    data.images.forEach(img=>{

        gallery.innerHTML +=`

        <div class="card">

            <img src="${img.image_url}">

            <p>${img.prompt}</p>

            <div class="actions">

                <a href="${img.image_url}" target="_blank">

                    <button>Download</button>

                </a>

                <button onclick="deleteImage(${img.id})">

                    Delete

                </button>

            </div>

        </div>

        `;

    });

}

async function deleteImage(id){

    await fetch("/images/"+id,{

        method:"DELETE"

    });

    loadImages();

}