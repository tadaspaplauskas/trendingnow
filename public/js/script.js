window.onload = function ()
{
    var sf = document.getElementById("search-form");
    var si = document.getElementById("search-input");

    if (sf !== null && si !== null)
    {
        sf.onsubmit = function ()
        {
            window.location = "/keywords/" + escape(si.value);
            return false;
        };
    }
};