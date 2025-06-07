class OrganizationGraph {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    // Set canvas size
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    // Graph data
    this.nodes = [];
    this.edges = [];
    // View controls
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.dragTarget = null;
    this.lastMousePos = { x: 0, y: 0 };
    this.hoveredNode = null;
    this.mouseDownPos = { x: 0, y: 0 }; // Track initial mouse position for click detection
    this.dragThreshold = 5; // Pixels moved before considering it a drag

    // Physics simulation
    this.physicsEnabled = true;
    this.animationId = null;
    // Visual settings
    this.nodeRadius = 25; // Default, used if no specific type matches
    this.employeeRadius = 12.5; // Half the default size
    this.projectRadius = 22; // Custom size for projects
    //team radius is dynamic based on number of employees
    this.nodeColors = {
      employee: "#64b5f6",
      team: "#81c784",
      project: "#9370DB",
    };
    this.edgeColors = {
      member: "#81c784",
      mentor: "#ffb74d",
      assignment: "#9370DB",
    };
    this.showProjects = true;
    this.showMentorships = true;
    this.showTeams = true;
    // Search functionality
    this.highlightedNode = null;
    this.searchResults = []; // Selection functionality
    this.selectedNode = null;

    // Mouse tracking for click vs drag detection
    this.mouseDownPos = null;
    this.dragThreshold = 5; // pixels
    this.lastMousePos = null;

    // External URL configuration for opening nodes in new tabs
    this.baseUrls = {
      employee: "https://your-hr-system.com/employee/",
      team: "https://your-team-system.com/team/",
      project: "https://your-project-system.com/project/",
    };

    this.setupEventListeners();
    this.startAnimation();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheel(e));

    // Prevent context menu
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.camera.x) / this.camera.zoom,
      y: (e.clientY - rect.top - this.camera.y) / this.camera.zoom,
    };
  }
  getNodeAt(pos) {
    return this.nodes.find((node) => {
      const dx = node.x - pos.x;
      const dy = node.y - pos.y;
      const radius = this.getNodeRadius(node);
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });
  }

  // Helper method to get the radius for any node
  getNodeRadius(node) {
    if (node.type === "employee") return this.employeeRadius;
    else if (node.type === "team") return node.radius;
    else if (node.type === "project") return this.projectRadius;
    return this.nodeRadius; // Default fallback
  }
  onMouseDown(e) {
    const mousePos = this.getMousePos(e);
    const node = this.getNodeAt(mousePos);

    this.mouseDownPos = { x: e.clientX, y: e.clientY };

    if (node) {
      this.dragTarget = node;
      this.isDragging = false; // Don't set to true immediately, wait for movement
      node.fixed = true;
    } else {
      this.isDragging = false;
      this.dragTarget = null;
      // Clear selection when clicking empty space
      this.selectNode(null);
    }

    this.lastMousePos = { x: e.clientX, y: e.clientY };
  }
  onMouseMove(e) {
    const dx = e.clientX - this.lastMousePos.x;
    const dy = e.clientY - this.lastMousePos.y;

    // Check if we've moved enough to start dragging
    if (!this.isDragging && this.mouseDownPos) {
      const totalMovement = Math.sqrt(
        Math.pow(e.clientX - this.mouseDownPos.x, 2) +
          Math.pow(e.clientY - this.mouseDownPos.y, 2)
      );
      if (totalMovement > this.dragThreshold) {
        this.isDragging = true;
      }
    }

    if (this.isDragging) {
      if (this.dragTarget) {
        // Move node
        this.dragTarget.x += dx / this.camera.zoom;
        this.dragTarget.y += dy / this.camera.zoom;
      } else {
        // Pan camera
        this.camera.x += dx;
        this.camera.y += dy;
      }
    } else {
      // Check for hover
      const mousePos = this.getMousePos(e);
      this.hoveredNode = this.getNodeAt(mousePos);
    }

    this.lastMousePos = { x: e.clientX, y: e.clientY };
  }
  onMouseUp(e) {
    // Check if this was a click (not a drag)
    if (!this.isDragging && this.dragTarget) {
      this.selectNode(this.dragTarget);
    }

    if (this.dragTarget) {
      this.dragTarget.fixed = false;
    }

    // Reset all mouse tracking state
    this.isDragging = false;
    this.dragTarget = null;
    this.mouseDownPos = null;
  }

  onWheel(e) {
    e.preventDefault();

    const mousePos = {
      x: e.clientX,
      y: e.clientY,
    };

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(3, this.camera.zoom * zoomFactor));

    // Zoom towards mouse cursor
    const worldPos = {
      x: (mousePos.x - this.camera.x) / this.camera.zoom,
      y: (mousePos.y - this.camera.y) / this.camera.zoom,
    };

    this.camera.zoom = newZoom;
    this.camera.x = mousePos.x - worldPos.x * this.camera.zoom;
    this.camera.y = mousePos.y - worldPos.y * this.camera.zoom;
  }

  loadData(data) {
    this.createNodesAndEdges(data);
  }

  createNodesAndEdges(data) {
    this.nodes = [];
    this.edges = [];
    this.departments = [];
    const verticalSpacing = 10;
    const containerHeight = 800;
    const containerWidth = 1000;

    // Calculate team sizes (number of employees per team)
    const teamSizes = {};
    data.employees.forEach((employee) => {
      if (employee.team) {
        teamSizes[employee.team] = (teamSizes[employee.team] || 0) + 1;
      }
    });

    //Create department containers
    data.departments.forEach((dept, index) => {
      const column = index % 2; // 0 for left, 1 for right
      const row = Math.floor(index / 2); // 0 for first row, 1 for second row, etc.
      const x = (column - 0.5) * (containerWidth + 10); // Position: left at -502.5, right at 502.5
      const y = row * (verticalSpacing + containerHeight); // Vertical spacing: 850px between rows
      this.departments.push({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        x: x,
        y: y,
        width: containerWidth,
        height: containerHeight,
      });
    });

    // Create project nodes within departments
    data.projects.forEach((project, index) => {
      const dept = this.departments.find((d) => d.id === project.department);
      if (!dept) {
        console.warn(`Department not found for project ${project.id}`);
        return;
      }
      // Simple positioning for now, distribute them a bit
      const projectAngle = (index / data.projects.length) * 2 * Math.PI;
      const projectRadiusOffset = dept.width / 4; // Place them within the department

      this.nodes.push({
        id: project.id,
        label: project.name,
        type: "project",
        description: project.description,
        department: project.department,
        x: dept.x + Math.cos(projectAngle) * projectRadiusOffset,
        y: dept.y + Math.sin(projectAngle) * projectRadiusOffset + 50, // Offset Y to avoid overlap with teams
        vx: 0,
        vy: 0,
        fixed: false,
      });
    });
    // Create team nodes within departments
    data.teams.forEach((team, index) => {
      const dept = this.departments.find((d) => d.id === team.department);
      const teamAngle = (index % 3) * ((2 * Math.PI) / 3);
      const radiusPerEmployee = 12;
      const minTeamRadius = 25;
      const employeeCount = teamSizes[team.id] || 0;
      const teamRadius = Math.max(
        minTeamRadius,
        employeeCount * radiusPerEmployee
      );

      this.nodes.push({
        id: team.id,
        label: team.name,
        type: "team",
        description: team.description,
        department: team.department,
        radius: teamRadius,
        employeeCount: employeeCount, // Store employee count for reference
        x: dept.x + Math.cos(teamAngle) * 100,
        y: dept.y + Math.sin(teamAngle) * 100,
        vx: 0,
        vy: 0,
        fixed: false,
      });
    });

    // Create employee nodes within departments
    data.employees.forEach((employee, index) => {
      const dept = this.departments.find((d) => d.id === employee.department);
      if (!dept) {
        console.warn(`Department not found for employee ${employee.id}`);
        return;
      }
      const angle = Math.random() * 2 * Math.PI;
      const radius = 50 + Math.random() * 150;

      this.nodes.push({
        id: employee.id,
        label: employee.name,
        type: "employee",
        role: employee.role,
        team: employee.team,
        department: employee.department,
        x: dept.x + Math.cos(angle) * radius,
        y: dept.y + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fixed: false,
      });
    });

    // Create team membership edges
    data.employees.forEach((employee) => {
      this.edges.push({
        source: employee.id,
        target: employee.team,
        type: "member",
      });
    });

    // Create project assignment edges
    data.employees.forEach((employee) => {
      if (employee.projects && employee.projects.length > 0) {
        employee.projects.forEach((projectId) => {
          const projectNode = this.nodes.find(
            (n) => n.id === projectId && n.type === "project"
          );
          const employeeNode = this.nodes.find(
            (n) => n.id === employee.id && n.type === "employee"
          );
          if (projectNode && employeeNode) {
            this.edges.push({
              source: employee.id,
              target: projectId,
              type: "assignment",
            });
          } else {
            if (!projectNode)
              console.warn(
                `Project node ${projectId} not found for assignment edge for employee ${employee.id}`
              );
            if (!employeeNode)
              console.warn(
                `Employee node ${employee.id} not found for assignment edge to project ${projectId}`
              );
          }
        });
      }
    });

    this.centerGraph();
  }

  getVisibleNodes() {
    return this.nodes.filter((node) => {
      if (node.type === "project" && !this.showProjects) return false;
      if (node.type === "team" && !this.showTeams) return false;
      // If a team is hidden, also hide its members if they aren't part of another visible entity (e.g. project)
      if (node.type === "employee" && !this.showTeams) {
        const team = this.nodes.find(
          (t) => t.id === node.team && t.type === "team"
        );
        if (team && !this.showTeams) {
          // Check if employee is involved in a visible project
          const involvedInVisibleProject =
            this.showProjects &&
            this.edges.some(
              (edge) =>
                edge.type === "assignment" &&
                (edge.source === node.id || edge.target === node.id) &&
                this.nodes.find(
                  (n) =>
                    (n.id === edge.source || n.id === edge.target) &&
                    n.type === "project" &&
                    this.showProjects
                )
            );
          if (!involvedInVisibleProject) return false;
        }
      }
      return true;
    });
  }

  getVisibleEdges() {
    return this.edges.filter((edge) => {
      if (edge.type === "assignment" && !this.showProjects) return false;
      if (edge.type === "member" && !this.showTeams) return false;

      // Ensure both source and target nodes of an edge are visible
      const sourceNode = this.nodes.find((n) => n.id === edge.source);
      const targetNode = this.nodes.find((n) => n.id === edge.target);

      if (sourceNode && targetNode) {
        if (sourceNode.type === "project" && !this.showProjects) return false;
        if (targetNode.type === "project" && !this.showProjects) return false;
        if (sourceNode.type === "team" && !this.showTeams) return false;
        if (targetNode.type === "team" && !this.showTeams) return false;

        // If a team is hidden, hide member edges unless the employee is otherwise visible
        if (edge.type === "member" && !this.showTeams) {
          const employeeNode =
            sourceNode.type === "employee" ? sourceNode : targetNode;
          const teamNode = sourceNode.type === "team" ? sourceNode : targetNode;
          if (teamNode && !this.showTeams) {
            const isEmployeeVisible = this.getVisibleNodes().some(
              (n) => n.id === employeeNode.id
            );
            if (!isEmployeeVisible) return false;
          }
        }
      }

      return true;
    });
  }

  updatePhysics() {
    if (!this.physicsEnabled) return;

    const visibleNodes = this.getVisibleNodes();
    const visibleEdges = this.getVisibleEdges();

    const repulsionStrength = 2000;
    const attractionStrength = 0.1;
    const damping = 0.92;
    const minDistance = 50;

    // Reset forces
    visibleNodes.forEach((node) => {
      if (!node.fixed) {
        node.fx = 0;
        node.fy = 0;
      }
    });

    // Node-node repulsion
    for (let i = 0; i < visibleNodes.length; i++) {
      for (let j = i + 1; j < visibleNodes.length; j++) {
        const nodeA = visibleNodes[i];
        const nodeB = visibleNodes[j];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance < 250) {
          const force = repulsionStrength / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          if (!nodeA.fixed) {
            nodeA.fx -= fx;
            nodeA.fy -= fy;
          }
          if (!nodeB.fixed) {
            nodeB.fx += fx;
            nodeB.fy += fy;
          }
        }
      }
    }

    // Edge attraction
    visibleEdges.forEach((edge) => {
      const source = visibleNodes.find((n) => n.id === edge.source);
      const target = visibleNodes.find((n) => n.id === edge.target);

      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const targetDistance = edge.type === "assignment" ? 110 : 240;

        // Different attraction strengths based on edge type
        let edgeAttractionStrength = attractionStrength;
        if (edge.type === "assignment") {
          // Projects have full attraction strength
          edgeAttractionStrength = attractionStrength;
        } else if (edge.type === "member") {
          // Teams have half the attraction strength of projects
          edgeAttractionStrength = attractionStrength * 0.5;
        }

        if (distance > 0) {
          const force = (distance - targetDistance) * edgeAttractionStrength;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          if (!source.fixed) {
            source.fx += fx;
            source.fy += fy;
          }
          if (!target.fixed) {
            target.fx -= fx;
            target.fy -= fy;
          }
        }
      }
    }); // Apply forces and update positions
    visibleNodes.forEach((node) => {
      if (!node.fixed) {
        node.vx = (node.vx + node.fx) * damping;
        node.vy = (node.vy + node.fy) * damping;

        // Additional velocity-based damping for faster settling
        const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (velocity > 0.1) {
          const velocityDamping = Math.max(0.8, 1 - velocity * 0.01);
          node.vx *= velocityDamping;
          node.vy *= velocityDamping;
        } else if (velocity < 0.01) {
          // Stop very small movements to prevent endless drift
          node.vx = 0;
          node.vy = 0;
        }

        node.x += node.vx;
        node.y += node.vy; // Constrain nodes within their department boundaries
        if (node.department && this.departments) {
          const dept = this.departments.find((d) => d.id === node.department);
          if (dept) {
            const nodeRadius = this.getNodeRadius(node);

            const margin = nodeRadius + 10;
            const minX = dept.x - dept.width / 2 + margin;
            const maxX = dept.x + dept.width / 2 - margin;
            const minY = dept.y - dept.height / 2 + margin;
            const maxY = dept.y + dept.height / 2 - margin;

            if (node.x < minX) {
              node.x = minX;
              node.vx = Math.abs(node.vx) * 0.5; // Bounce back with reduced velocity
            }
            if (node.x > maxX) {
              node.x = maxX;
              node.vx = -Math.abs(node.vx) * 0.5;
            }
            if (node.y < minY) {
              node.y = minY;
              node.vy = Math.abs(node.vy) * 0.5;
            }
            if (node.y > maxY) {
              node.y = maxY;
              node.vy = -Math.abs(node.vy) * 0.5;
            }
          }
        }
      }
    });
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(this.camera.x, this.camera.y);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);

    const visibleNodes = this.getVisibleNodes();
    const visibleEdges = this.getVisibleEdges();

    // Draw department containers
    if (this.departments) {
      this.departments.forEach((dept) => {
        // Department box
        this.ctx.strokeStyle = "#888888"; // Grey border
        this.ctx.lineWidth = 2; // Standard line width

        const x = dept.x - dept.width / 2;
        const y = dept.y - dept.height / 2;

        // this.ctx.fillRect(x, y, dept.width, dept.height); // Removed fillRect
        this.ctx.strokeRect(x, y, dept.width, dept.height);

        // Department label
        this.ctx.fillStyle = "#ffffff"; // White for text
        this.ctx.font = 'bold 18px "Segoe UI"';
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "top";
        this.ctx.fillText(dept.name, dept.x, y + 10);

        // Department description
        this.ctx.fillStyle = "#ffffff"; // White for description
        this.ctx.font = '12px "Segoe UI"';
        this.ctx.fillText(dept.description, dept.x, y + 35);
      });
    }

    // Draw edges
    visibleEdges.forEach((edge) => {
      const source = visibleNodes.find((n) => n.id === edge.source);
      const target = visibleNodes.find((n) => n.id === edge.target);

      if (source && target) {
        this.ctx.strokeStyle = this.edgeColors[edge.type];
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = edge.type === "assignment" ? 0.7 : 0.6;

        this.ctx.beginPath();
        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
        this.ctx.stroke();
      }
    });
    visibleNodes.forEach((node) => {
      this.ctx.globalAlpha = 1;

      const isHovered = this.hoveredNode === node;
      const isHighlighted = this.highlightedNode === node;
      const isSelected = this.selectedNode === node;

      const baseRadius = this.getNodeRadius(node);

      const radius =
        baseRadius +
        (isHovered ? 5 : 0) +
        (isHighlighted ? 8 : 0) +
        (isSelected ? 6 : 0);

      // Node circle
      this.ctx.fillStyle = this.nodeColors[node.type];

      // Special highlighting for search results
      if (isHighlighted) {
        this.ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"; // Half transparent yellow highlight
        this.ctx.lineWidth = 4;
        // Add a pulsing effect
        const pulseRadius = radius + Math.sin(Date.now() * 0.01) * 3;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, pulseRadius, 0, 2 * Math.PI);
        this.ctx.stroke();
      } else if (isSelected) {
        // Blue selection indicator
        this.ctx.strokeStyle = "rgba(150, 150, 255, 0.2)";
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
        this.ctx.stroke();
      } else {
        this.ctx.strokeStyle = isHovered ? "#ffffff" : "#333333";
        this.ctx.lineWidth = isHovered ? 3 : 2;
      }

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.stroke();
      // Node label - handle text wrapping for teams
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = `${isHovered ? "bold " : ""}12px 'Segoe UI'`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";

      if (node.type === "team") {
        // Split team name into words and wrap "Team" to second line
        const words = node.label.split(" ");
        if (
          words.length >= 2 &&
          words[words.length - 1].toLowerCase() === "team"
        ) {
          const firstLine = words.slice(0, -1).join(" ");
          const secondLine = words[words.length - 1];

          this.ctx.fillText(firstLine, node.x, node.y - 7);
          this.ctx.fillText(secondLine, node.x, node.y + 7);
        } else {
          this.ctx.fillText(node.label, node.x, node.y);
        }
      } else {
        this.ctx.fillText(node.label, node.x, node.y);
      } // Show additional info on hover
      if (isHovered) {
        let info;
        if (node.type === "employee") {
          info = node.role;
        } else if (node.type === "project") {
          info = node.description;
        } else if (node.type === "team") {
          // Show team description and employee count
          const employeeCount = node.employeeCount || 0;
          info = `${node.description}\n${employeeCount} employee${
            employeeCount !== 1 ? "s" : ""
          }`;
        } else {
          info = node.description;
        }

        if (info) {
          const lines = info.split("\n");
          const lineHeight = 14;
          const padding = 8;
          const boxWidth =
            Math.max(...lines.map((line) => this.ctx.measureText(line).width)) +
            padding * 2;
          const boxHeight = lines.length * lineHeight + padding * 2;
          // Tooltip background
          this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          this.ctx.fillRect(
            node.x - boxWidth / 2,
            node.y - radius - boxHeight - 5,
            boxWidth,
            boxHeight
          );
          // Tooltip text
          this.ctx.fillStyle = "#ffffff";
          this.ctx.font = '11px "Segoe UI"';
          lines.forEach((line, index) => {
            this.ctx.fillText(
              line,
              node.x,
              node.y -
                radius -
                boxHeight -
                10 +
                padding +
                (index + 1) * lineHeight
            );
          });
        }
      }
    });

    this.ctx.restore();
  }

  animate() {
    this.updatePhysics();
    this.render();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  startAnimation() {
    this.animate();
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  togglePhysics() {
    this.physicsEnabled = !this.physicsEnabled;
    const btn = document.getElementById("physics-btn");
    btn.textContent = this.physicsEnabled ? "Pause Physics" : "Resume Physics";
  }

  toggleProjectsVisibility() {
    this.showProjects = !this.showProjects;
    const btn = document.getElementById("toggle-projects-btn");
    btn.textContent = this.showProjects ? "Hide Projects" : "Show Projects";
  }

  toggleTeamsVisibility() {
    this.showTeams = !this.showTeams;
    const btn = document.getElementById("toggle-teams-btn");
    btn.textContent = this.showTeams ? "Hide Teams" : "Show Teams";
  }

  resetView() {
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.centerGraph();
  }

  centerGraph() {
    if (this.nodes.length === 0) return;

    const visibleNodes = this.getVisibleNodes();
    if (visibleNodes.length === 0) {
      // If no nodes are visible, reset camera to default position or a sensible overview
      this.camera.x = this.canvas.width / 2;
      this.camera.y = this.canvas.height / 2;
      this.camera.zoom = 1; // Or a zoom level that shows department outlines
      return;
    }

    // Calculate bounds of visible nodes
    let minX = visibleNodes[0].x,
      maxX = visibleNodes[0].x;
    let minY = visibleNodes[0].y,
      maxY = visibleNodes[0].y;

    visibleNodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    // Center the graph
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.camera.x = this.canvas.width / 2 - centerX * this.camera.zoom;
    this.camera.y = this.canvas.height / 2 - centerY * this.camera.zoom;
  }

  // Search functionality
  searchNodes(query) {
    if (!query || query.trim() === "") {
      this.searchResults = [];
      this.highlightedNode = null;
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    this.searchResults = this.nodes.filter((node) => {
      const label = node.label.toLowerCase();
      const type = node.type.toLowerCase();
      const role = node.role ? node.role.toLowerCase() : "";
      const description = node.description
        ? node.description.toLowerCase()
        : "";

      return (
        label.includes(searchTerm) ||
        type.includes(searchTerm) ||
        role.includes(searchTerm) ||
        description.includes(searchTerm)
      );
    });

    return this.searchResults;
  }

  highlightNode(node) {
    this.highlightedNode = node;
    this.focusOnNode(node);
  }

  focusOnNode(node) {
    if (!node) return;

    // Calculate the position to center the node on screen
    const targetX = this.canvas.width / 2 - node.x * this.camera.zoom;
    const targetY = this.canvas.height / 2 - node.y * this.camera.zoom;

    // Smoothly animate to the target position
    const animateToTarget = () => {
      const speed = 0.1;
      const dx = targetX - this.camera.x;
      const dy = targetY - this.camera.y;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        this.camera.x = targetX;
        this.camera.y = targetY;
        return;
      }

      this.camera.x += dx * speed;
      this.camera.y += dy * speed;

      requestAnimationFrame(animateToTarget);
    };

    animateToTarget();
  }

  clearSearch() {
    this.highlightedNode = null;
    this.searchResults = [];
  }

  // Selection functionality
  selectNode(node) {
    this.selectedNode = node;
    this.updateEditButton();
  }

  updateEditButton() {
    const editBtn = document.getElementById("edit-selected-btn");
    if (this.selectedNode) {
      editBtn.style.display = "block";
      editBtn.textContent = `Edit ${this.selectedNode.type}: ${this.selectedNode.label}`;
    } else {
      editBtn.style.display = "none";
    }
  }

  openSelectedNode() {
    if (!this.selectedNode) return;

    const baseUrl = this.baseUrls[this.selectedNode.type];
    if (baseUrl) {
      const url = `${baseUrl}${this.selectedNode.id}`;
      window.open(url, "_blank");
    } else {
      console.warn(
        `No base URL configured for node type: ${this.selectedNode.type}`
      );
    }
  }

  // Method to update base URLs from external configuration
  setBaseUrls(urls) {
    this.baseUrls = { ...this.baseUrls, ...urls };
  }
}
