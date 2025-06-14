document.addEventListener("DOMContentLoaded", function() {

       
        // Form submission handler
        const form = document.querySelector("form");

        form.addEventListener("submit", async function(e) {
            e.preventDefault();

            const submissionType = document.getElementById("submissionType").value;
            if (!submissionType) {
                alert("Please select a submission type");
                return;
            }

            const activeForm = document.getElementById(`${submissionType}Form`);
            if (!activeForm) {
                alert("Form section not found");
                return;
            }

            const requiredFields = activeForm.querySelectorAll("[required]");
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.reportValidity();
                    isValid = false;
                }
            });

            if (!isValid) {
                alert("Please fill all required fields");
                return;
            }

            // Handle file inputs correctly
            const fileInputs = form.querySelectorAll('input[type="file"]');

            // Clear all file input names first
            fileInputs.forEach(input => {
                input.removeAttribute("name");
            });

            // Set correct name only on active form's file input
            const activeFileInput = activeForm.querySelector('input[type="file"]');
            if (activeFileInput) {
                activeFileInput.name = "customFile";
            }


            const formData = new FormData();

            // Only pick active form section fields
            const activeFields = activeForm.querySelectorAll("input, select, textarea");
            activeFields.forEach(field => {
                if (field.type === "file") {
                    if (field.files[0]) {
                        formData.append("customFile", field.files[0]);
                    }
                } else if (field.type === "checkbox") {
                    if (field.checked) {
                        formData.append(field.name, field.value);
                    }
                } else {
                    formData.append(field.name, field.value);
                }
            });
            
            // Add submissionType manually
            formData.append("submissionType", submissionType);
            

            const submitBtn = form.querySelector("[type='submit']");

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';

            try {
                const response = await fetch("/Submit-Grant", {
                    method: "POST",
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    alert(`Submission successful! ${result.message}`);
                    form.reset();
                    window.location.href = "past-submissions.html";
                } else {
                    alert(`Error: ${result.message || "Submission failed"}`);
                }
            } catch (error) {
                console.error("Submission error:", error);
                alert("Failed to submit. Please try again.");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });

        //Form selection
        document.getElementById("submissionType").addEventListener("change", function() {
            const submissionType = this.value;
            const researchForm = document.getElementById("researchForm");
            const journalForm = document.getElementById("journalForm");
        
            if (submissionType === "research") {
                researchForm.style.display = "block";
                journalForm.style.display = "none";
        
                // Enable required for research, disable for journal
                researchForm.querySelectorAll("[data-required]").forEach(input => input.required = true);
                journalForm.querySelectorAll("[data-required]").forEach(input => input.required = false);
            } 
            else if (submissionType === "journal") {
                researchForm.style.display = "none";
                journalForm.style.display = "block";
        
                // Enable required for journal, disable for research
                researchForm.querySelectorAll("[data-required]").forEach(input => input.required = false);
                journalForm.querySelectorAll("[data-required]").forEach(input => input.required = true);
            }
        });

        //menu Toggle
        const sidebar = document.getElementById("sidebar");
        const menuToggle = document.getElementById("menuToggle");
    
        menuToggle.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    
        function openSettings() {
            alert("Settings page will have an option to change profile picture.");
        }
    
        if (window.innerWidth > 768) {
            sidebar.classList.add("open");
        }

        //Current Sidebar

        let sidebarLinks = document.querySelectorAll(".sidebar-link");
        let currentPage = window.location.pathname.split("/").pop(); // Get the filename of the current page
    
        sidebarLinks.forEach(link => {
            if (link.getAttribute("href") === currentPage) {
                link.classList.add("active"); // Highlight the active link
            }
        });

        //Coauthors
        document.getElementById("researchCoAuthorCount").addEventListener("change", function() {
            const container = document.getElementById("researchCoAuthorFields");
            container.innerHTML = "";
            
            for (let i = 1; i <= this.value; i++) {
                const div = document.createElement("div");
                div.className = "form-group mt-2";
                div.innerHTML = `
                    <label>Co-Author ${i} Name</label>
                    <input type="text" class="form-control" name="research_coauthors[]" required>
                `;
                container.appendChild(div);
            }
        });

        document.getElementById("journalCoAuthorCount").addEventListener("change", function() {
            const container = document.getElementById("journalCoAuthorFields");
            container.innerHTML = "";
            
            for (let i = 1; i <= this.value; i++) {
                const div = document.createElement("div");
                div.className = "form-group mt-2";
                div.innerHTML = `
                    <label>Co-Author ${i} Name</label>
                    <input type="text" class="form-control" name="journal_coauthors[]" required>
                `;
                container.appendChild(div);
            }
        });

        //Validation
        let userRemainingGrant = 20000;
        let currentSubmissionType = 'research';

        // Update grant limit when submission type changes
        document.getElementById("submissionType").addEventListener("change", function() {
            currentSubmissionType = this.value;
            updateGrantLimit();
            updateFieldNames(); // Update field names when type changes
           
        });

        // Initial setup
        updateGrantLimit().then(() => {
           setupAutoCalculationAndValidation('research');
           setupAutoCalculationAndValidation('journal');
        });

       
        async function updateGrantLimit() {
            try {
                const response = await fetch("/api/user");
                const data = await response.json();
                
                if (data.success && data.user) {
                    const email = data.user.email;
                    const endpoint = currentSubmissionType === "research" 
                        ? "/api/user-remaining-grant-research" 
                        : "/api/user-remaining-grant-journal";
                    
                    const res = await fetch(`${endpoint}?email=${encodeURIComponent(email)}`);
                    const json = await res.json();
                    if (json.success) {
                        userRemainingGrant = json.remainingGrant;
                    }
                }
            } catch (error) {
                console.error("Error fetching grant limit:", error);
            }
        }

                // Add this function to handle both auto-calculation and validation
        function setupAutoCalculationAndValidation(prefix) {
            const rf = document.querySelector(`[name="${prefix}_rf"]`);
            const tc = document.querySelector(`[name="${prefix}_tc"]`);
            const lc = document.querySelector(`[name="${prefix}_lc"]`);
            const tga = document.querySelector(`[name="${prefix}_tga"]`);
            const submitBtn = document.querySelector("button[type='submit']");
            
            if (!rf || !tc || !lc || !tga) return;

            // Create error display element if it doesn't exist
            let errorBox = tga.parentNode.querySelector(".grant-error");
            if (!errorBox) {
                errorBox = document.createElement("div");
                errorBox.className = "grant-error mt-2";
                errorBox.style.color = "red";
                tga.parentNode.appendChild(errorBox);
            }

            const calculateAndValidate = () => {
                // Calculate total
                const rfValue = parseFloat(rf.value) || 0;
                const tcValue = parseFloat(tc.value) || 0;
                const lcValue = parseFloat(lc.value) || 0;
                const total = rfValue + tcValue + lcValue;
                
                tga.value = total;
                
                // Validate against grant limit
                if (total > userRemainingGrant) {
                    errorBox.textContent = `Exceeds remaining limit (₹${userRemainingGrant.toFixed(2)})`;
                    if (submitBtn) submitBtn.disabled = true;
                } else {
                    errorBox.textContent = "";
                    if (submitBtn) submitBtn.disabled = false;
                }
            };

            // Add event listeners
            rf.addEventListener('input', calculateAndValidate);
            tc.addEventListener('input', calculateAndValidate);
            lc.addEventListener('input', calculateAndValidate);
            
            // Initial calculation
            calculateAndValidate();
        }
        // Fix field name mismatches
        function updateFieldNames() {
            const type = document.getElementById("submissionType").value;
            if (!type) return;

            const prefix = type === "research" ? "research_" : "journal_";
            
            // Update file input name to match server expectation
            const fileInput = document.querySelector(`[name="${prefix}customFile"]`);
            if (fileInput) {
                fileInput.name = "customFile";
            }
        }


    






    
});
