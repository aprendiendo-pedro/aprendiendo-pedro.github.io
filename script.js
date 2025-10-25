async function fetchKind(repoFullName) {
    try {
        const propRes = await fetch(
            `https://aprendiendo-pedro.vercel.app/api/github?endpoint=repos/${repoFullName}/properties/values`,
            {
                headers: {
                    'Accept': 'application/vnd.github+json'
                }
            }
        );
        if (propRes.ok) {
            const propertyData = await propRes.json();
            const kindProperty = Array.isArray(propertyData)
                ? propertyData.find(p => p.property_name === 'Tipo_general')
                : null;
            return kindProperty?.value || null;
        }
    } catch (err) { }
    return null;
}

async function getFirstHtmlFileName(repoFullName) {
    try {
        const res = await fetch(
            `https://aprendiendo-pedro.vercel.app/api/github?endpoint=repos/${repoFullName}/contents/`,
            {
                headers: {
                    'Accept': 'application/vnd.github+json'
                }
            }
        );
        if (res.ok) {
            const files = await res.json();
            if (Array.isArray(files)) {
                const htmlFile = files.find(f => f.type === 'file' && f.name.endsWith('.html'));
                if (htmlFile) {
                    return htmlFile.name;
                }
            }
        }
    } catch (err) { }
    return null;
}

function getGitHubPagesUrl(owner, repo, fileName) {
    return `https://${owner}.github.io/${repo}/${fileName}`;
}

async function getRepoDetails(repoFullName, org) {
    let kind = null;
    let relatedSubjects = [];
    let firstHtmlFileName = null;
    try {
        const propRes = await fetch(
            `https://aprendiendo-pedro.vercel.app/api/github?endpoint=repos/${repoFullName}/properties/values`,
            {
                headers: {
                    'Accept': 'application/vnd.github+json'
                }
            }
        );
        if (propRes.ok) {
            const propertyData = await propRes.json();
            const kindProperty = Array.isArray(propertyData)
                ? propertyData.find(p => p.property_name === 'Tipo_general')
                : null;
            kind = kindProperty?.value || null;
            if (kind === 'Acto docente') {
                const subjectsProp = Array.isArray(propertyData)
                    ? propertyData.find(p => p.property_name === 'Asignatura')
                    : null;
                if (subjectsProp && Array.isArray(subjectsProp.value)) {
                    relatedSubjects = await Promise.all(
                        subjectsProp.value.map(async subjectName => {
                            const subjectRes = await fetch(
                                `https://aprendiendo-pedro.vercel.app/api/github?endpoint=repos/${org}/${subjectName}`,
                                {
                                    headers: {
                                        'Accept': 'application/vnd.github+json'
                                    }
                                }
                            );
                            if (subjectRes.ok) {
                                const subjectRepo = await subjectRes.json();
                                let firstHtmlFile = await getFirstHtmlFileName(`${org}/${subjectRepo.name}`);
                                return {
                                    name: subjectRepo.name,
                                    html_url: subjectRepo.html_url,
                                    owner: subjectRepo.owner.login,
                                    firstHtmlFileName: firstHtmlFile
                                };
                            }
                            return null;
                        })
                    );
                    relatedSubjects = relatedSubjects.filter(s => s);
                }
            }
        }
        firstHtmlFileName = await getFirstHtmlFileName(repoFullName);
    } catch (err) { }

    return {
        kind,
        relatedSubjects,
        firstHtmlFileName
    };
}

async function searchInOrg() {
    const searchTerm = document.getElementById('search-term').value.trim();
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const expandedSearch = document.getElementById('expanded-search').checked;
    const org = 'aprendiendo-cosas';

    if (!searchTerm) {
        alert('Por favor, introduzca un término de búsqueda');
        return;
    }

    loadingDiv.classList.remove('hidden');
    resultsDiv.innerHTML = '';

    try {
        const repoQuery = encodeURIComponent(`${searchTerm} org:${org}`);
        const repoRes = await fetch(`https://aprendiendo-pedro.vercel.app/api/github?endpoint=search/repositories?q=${repoQuery}`, {
            headers: {
                'Accept': 'application/vnd.github+json'
            }
        });
        if (!repoRes.ok) throw new Error(`GitHub API error: ${repoRes.status}`);
        const repoData = await repoRes.json();
        const repoMap = {};
        if (repoData.items) {
            repoData.items.forEach(repo => {
                repoMap[repo.full_name] = repo;
            });
        }
        if (expandedSearch) {
            const codeQuery = encodeURIComponent(`${searchTerm} org:${org}`);
            const codeRes = await fetch(`https://aprendiendo-pedro.vercel.app/api/github?endpoint=search/code?q=${codeQuery}`, {
                headers: {
                    'Accept': 'application/vnd.github+json'
                }
            });
            if (codeRes.ok) {
                const codeData = await codeRes.json();
                codeData.items.forEach(file => {
                    if (file.repository && file.repository.full_name) {
                        repoMap[file.repository.full_name] = file.repository;
                    }
                });
            }
        }
        const repoFullNames = Object.keys(repoMap);
        if (repoFullNames.length === 0) {
            loadingDiv.classList.add('hidden');
            resultsDiv.innerHTML = '<p>No se encontraron resultados</p>';
            return;
        }
        const kindsMap = {};
        await Promise.all(repoFullNames.map(async repoFullName => {
            kindsMap[repoFullName] = await fetchKind(repoFullName);
        }));

        const asignaturas = [];
        const actosDocentes = [];
        const otros = [];
        repoFullNames.forEach(repoFullName => {
            const repo = repoMap[repoFullName];
            const kind = kindsMap[repoFullName];
            if (kind === 'Asignatura') {
                asignaturas.push(repo);
            } else if (kind === 'Acto docente') {
                actosDocentes.push(repo);
            } else {
                otros.push(repo);
            }
        });

        const detailsMap = {};
        await Promise.all(repoFullNames.map(async repoFullName => {
            const repo = repoMap[repoFullName];
            const orgName = repo.owner.login;
            detailsMap[repoFullName] = await getRepoDetails(repoFullName, orgName);
        }));

        loadingDiv.classList.add('hidden');

        let htmlSections = '';
        function makeSection(title, repoList) {
            if (repoList.length === 0) return '';
            let githubIcon = '<i class="fab fa-github" title="Repositorio"></i>';
            let html = `<h1 class="section-title">${title}</h1><div class="results">`;
            repoList.forEach(repo => {
                const repoFullName = repo.full_name;
                const details = detailsMap[repoFullName];
                let detailsHtml = '';
                if (details.kind === 'Acto docente' && Array.isArray(details.relatedSubjects) && details.relatedSubjects.length > 0) {
                    detailsHtml += '<div class="related-subjects"><strong>Asignaturas relacionadas:</strong> ';
                    detailsHtml += details.relatedSubjects.map(subj => {
                        let subjectPageUrl = subj.firstHtmlFileName
                            ? getGitHubPagesUrl(subj.owner, subj.name, subj.firstHtmlFileName)
                            : null;
                        let nameHtml = subjectPageUrl
                            ? `<a href="${subjectPageUrl}" target="_blank">${subj.name}</a>`
                            : subj.name;
                        let repoIconHtml = `<a href="${subj.html_url}" target="_blank">${githubIcon}</a>`;
                        return `${nameHtml} | ${repoIconHtml}`;
                    }).join(', '); detailsHtml += '</div>';
                }
                let fileLink = null;
                if (details.firstHtmlFileName) {
                    fileLink = getGitHubPagesUrl(repo.owner.login, repo.name, details.firstHtmlFileName);
                }
                html += `
        <div class="repo-card">
            <h3>
                ${fileLink
                        ? `<a href="${fileLink}" target="_blank">${repo.name}</a> | <a href="${repo.html_url}" target="_blank" title="Repositorio">${githubIcon}</a>`
                        : `${repo.name} | <a href="${repo.html_url}" target="_blank" title="Repositorio">${githubIcon}</a>`}
            </h3>
            <p>${repo.description ? repo.description : ''}</p>
            <div class="repo-details">${detailsHtml}</div>
        </div>
        `;
            });
            html += '</div>';
            return html;
        }
        htmlSections += makeSection('Asignaturas', asignaturas);
        htmlSections += makeSection('Actos docentes', actosDocentes);
        htmlSections += makeSection('Otros', otros);

        resultsDiv.innerHTML = htmlSections;

    } catch (error) {
        loadingDiv.classList.add('hidden');
        resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        console.error('Error:', error);
    }
}

document.getElementById('search-term').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchInOrg();
    }
});